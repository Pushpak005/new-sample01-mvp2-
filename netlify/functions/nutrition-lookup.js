// netlify/functions/nutrition-lookup.js
// Multi-tier nutrition lookup with fallbacks
// Priority: Local DB → USDA → Edamam → OpenFoodFacts → Estimated

const fs = require('fs');
const path = require('path');

// Load local Indian food database
let indianFoodsDB = null;
function loadIndianFoodsDB() {
  if (!indianFoodsDB) {
    try {
      const dbPath = path.join(__dirname, '../../data/indian_foods_nutrition.json');
      const data = fs.readFileSync(dbPath, 'utf8');
      indianFoodsDB = JSON.parse(data);
    } catch (e) {
      console.warn('Failed to load Indian foods database:', e.message);
      indianFoodsDB = { foods: [] };
    }
  }
  return indianFoodsDB;
}

// Search in local Indian food database
function searchLocalDB(query) {
  const db = loadIndianFoodsDB();
  const searchTerm = query.toLowerCase().trim();
  
  // Direct name match
  let match = db.foods.find(f => f.name.toLowerCase() === searchTerm);
  if (match) return { ...match, source: 'Indian Foods DB' };
  
  // Alias match
  match = db.foods.find(f => 
    f.aliases && f.aliases.some(a => a.toLowerCase() === searchTerm)
  );
  if (match) return { ...match, source: 'Indian Foods DB' };
  
  // Partial match (contains)
  match = db.foods.find(f => 
    f.name.toLowerCase().includes(searchTerm) ||
    (f.aliases && f.aliases.some(a => a.toLowerCase().includes(searchTerm)))
  );
  if (match) return { ...match, source: 'Indian Foods DB' };
  
  return null;
}

// Search USDA FoodData Central (free, no key required)
async function searchUSDA(query) {
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=1&api_key=DEMO_KEY`;
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.foods || data.foods.length === 0) return null;
    
    const food = data.foods[0];
    const nutrients = {};
    
    // Map USDA nutrient IDs to our format
    const nutrientMap = {
      '1008': 'kcal',           // Energy
      '1003': 'protein_g',      // Protein
      '1005': 'carbs_g',        // Carbohydrate
      '1004': 'fat_g',          // Total lipid (fat)
      '1079': 'fiber_g',        // Fiber
      '1093': 'sodium_mg',      // Sodium
      '1089': 'iron_mg',        // Iron
      '1087': 'calcium_mg',     // Calcium
      '1106': 'vitamin_a_mcg',  // Vitamin A
      '1162': 'vitamin_c_mg',   // Vitamin C
      '1178': 'vitamin_d_mcg',  // Vitamin D
      '1175': 'vitamin_b12_mcg' // Vitamin B-12
    };
    
    if (food.foodNutrients) {
      food.foodNutrients.forEach(n => {
        const key = nutrientMap[String(n.nutrientId)];
        if (key) {
          nutrients[key] = n.value;
        }
      });
    }
    
    return {
      name: food.description,
      macros: {
        per: '100g',
        kcal: nutrients.kcal || null,
        protein_g: nutrients.protein_g || null,
        carbs_g: nutrients.carbs_g || null,
        fat_g: nutrients.fat_g || null,
        fiber_g: nutrients.fiber_g || null,
        sodium_mg: nutrients.sodium_mg || null
      },
      micros: {
        iron_mg: nutrients.iron_mg || null,
        calcium_mg: nutrients.calcium_mg || null,
        vitamin_a_mcg: nutrients.vitamin_a_mcg || null,
        vitamin_c_mg: nutrients.vitamin_c_mg || null,
        vitamin_d_mcg: nutrients.vitamin_d_mcg || null,
        vitamin_b12_mcg: nutrients.vitamin_b12_mcg || null
      },
      source: 'USDA FoodData Central',
      category: food.foodCategory || 'unknown'
    };
  } catch (e) {
    console.warn('USDA lookup failed:', e.message);
    return null;
  }
}

// Search OpenFoodFacts (existing fallback)
async function searchOpenFoodFacts(query) {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`;
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const product = (data.products || []).find(
      p => p.nutriments && (p.nutriments["energy-kcal_100g"] || p.nutriments["proteins_100g"])
    );
    
    if (!product) return null;
    
    const n = product.nutriments || {};
    return {
      name: product.product_name,
      macros: {
        per: '100g',
        kcal: n["energy-kcal_100g"] ?? null,
        protein_g: n["proteins_100g"] ?? null,
        carbs_g: n["carbohydrates_100g"] ?? null,
        fat_g: n["fat_100g"] ?? null,
        fiber_g: n["fiber_100g"] ?? null,
        sodium_mg: n["sodium_100g"] ? Math.round(n["sodium_100g"] * 1000) : null
      },
      source: 'OpenFoodFacts',
      product: { brand: product.brands, url: product.url }
    };
  } catch (e) {
    console.warn('OpenFoodFacts lookup failed:', e.message);
    return null;
  }
}

// Estimate based on food category and keywords
function estimateNutrition(query) {
  const q = query.toLowerCase();
  
  // Patterns for estimation
  const patterns = {
    protein_rich: /chicken|paneer|egg|fish|dal|rajma|chana|chickpea|protein|meat/,
    high_carb: /rice|bread|roti|chapati|naan|pasta|biryani|pulao/,
    high_fat: /butter|ghee|fried|pakora|samosa|oily|creamy/,
    vegetable: /vegetable|salad|greens|spinach|palak|sabzi/,
    fruit: /fruit|apple|banana|mango|orange/,
    dairy: /milk|curd|yogurt|dahi|cheese|paneer/
  };
  
  let estimated = {
    per: '100g',
    kcal: 150,  // default
    protein_g: 5,
    carbs_g: 25,
    fat_g: 3,
    fiber_g: 2,
    sodium_mg: 200
  };
  
  if (patterns.protein_rich.test(q)) {
    estimated = { per: '100g', kcal: 165, protein_g: 18, carbs_g: 5, fat_g: 8, fiber_g: 1, sodium_mg: 400 };
  } else if (patterns.high_carb.test(q)) {
    estimated = { per: '100g', kcal: 150, protein_g: 3, carbs_g: 30, fat_g: 2, fiber_g: 1.5, sodium_mg: 250 };
  } else if (patterns.high_fat.test(q)) {
    estimated = { per: '100g', kcal: 280, protein_g: 5, carbs_g: 20, fat_g: 18, fiber_g: 2, sodium_mg: 450 };
  } else if (patterns.vegetable.test(q)) {
    estimated = { per: '100g', kcal: 35, protein_g: 2, carbs_g: 7, fat_g: 0.5, fiber_g: 3, sodium_mg: 100 };
  } else if (patterns.fruit.test(q)) {
    estimated = { per: '100g', kcal: 60, protein_g: 0.5, carbs_g: 15, fat_g: 0.2, fiber_g: 2.5, sodium_mg: 5 };
  } else if (patterns.dairy.test(q)) {
    estimated = { per: '100g', kcal: 100, protein_g: 8, carbs_g: 5, fat_g: 6, fiber_g: 0, sodium_mg: 80 };
  }
  
  return {
    name: query,
    macros: estimated,
    source: 'Estimated',
    estimated: true,
    confidence: 'low'
  };
}

// Main handler
exports.handler = async (event) => {
  const query = (event.queryStringParameters || {}).q || '';
  
  if (!query) {
    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: 'Missing query parameter: q' }) 
    };
  }
  
  try {
    // Priority 1: Local Indian food database
    let result = searchLocalDB(query);
    if (result) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          found: true, 
          ...result,
          tier: 1,
          cached: true
        })
      };
    }
    
    // Priority 2: USDA FoodData Central
    result = await searchUSDA(query);
    if (result && result.macros.kcal) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          found: true, 
          ...result,
          tier: 2
        })
      };
    }
    
    // Priority 3: OpenFoodFacts
    result = await searchOpenFoodFacts(query);
    if (result && result.macros.kcal) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          found: true, 
          ...result,
          tier: 3
        })
      };
    }
    
    // Priority 4: Estimation
    result = estimateNutrition(query);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        found: true, 
        ...result,
        tier: 4,
        warning: 'Estimated values - may not be accurate'
      })
    };
    
  } catch (error) {
    console.error('Nutrition lookup error:', error);
    
    // Fallback to estimation even on error
    const result = estimateNutrition(query);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        found: true, 
        ...result,
        tier: 4,
        error: error.message
      })
    };
  }
};
