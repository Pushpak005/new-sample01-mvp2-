# Enhanced Nutrition Lookup Service - User Guide

## Overview

The Healthy Diet app now features an advanced, multi-tier nutrition lookup system that provides reliable, accurate nutrition information for Indian and international foods.

## What's New

### 🎯 Key Improvements

1. **Multi-Tier Lookup System**
   - **Tier 1**: Local Indian Food Database (40+ foods, instant, works offline)
   - **Tier 2**: USDA FoodData Central (free, comprehensive international database)
   - **Tier 3**: OpenFoodFacts (community-contributed data)
   - **Tier 4**: Smart Estimation (AI-powered fallback for unknown foods)

2. **Comprehensive Nutrition Data**
   - **Macros**: Calories, Protein, Carbs, Fat, Fiber, Sodium
   - **Micros**: Iron, Calcium, Vitamins A, C, D, B12
   - Source attribution for every food item
   - Confidence indicators for estimated values

3. **Indian Food Focus**
   - 40+ common Indian foods with verified nutrition data
   - Regional variants and aliases (e.g., "cottage cheese" → "paneer")
   - Based on IFCT 2017 and National Institute of Nutrition data
   - Standard portion sizes for Indian foods (katori, piece, plate)

4. **Nutrition Dashboard**
   - Real-time macro and micro tracking
   - Daily goal progress indicators
   - Smart AI-powered insights
   - Meal timeline view
   - Weekly trends (coming soon)

## How It Works

### Nutrition Lookup Process

When you view a food recommendation, the system:

1. **Checks Local Database First** (Tier 1)
   - Instant results for 40+ Indian foods
   - No internet required
   - 100% accurate, verified data

2. **Falls Back to USDA** (Tier 2)
   - If not in local database, queries USDA API
   - Free, no API key required
   - Comprehensive international food database

3. **Tries OpenFoodFacts** (Tier 3)
   - Community-contributed nutrition data
   - Good for packaged foods
   - Barcode database available

4. **Smart Estimation** (Tier 4)
   - If all else fails, AI estimates based on food category
   - Uses pattern matching and keyword analysis
   - Clearly marked as "estimated" with low confidence

### Using the Nutrition Dashboard

Access the dashboard by clicking the 📊 icon in the top navigation.

**Dashboard Features:**

1. **Today's Summary**
   - View calories, protein, carbs, fat consumed vs. goals
   - Color-coded progress bars
   - Remaining amounts calculated automatically

2. **Micronutrients**
   - % Daily Value for 6 key nutrients
   - Iron, Calcium, Vitamins A, C, D, B12
   - Color coding: Red (deficient), Green (good), Orange (excess)

3. **Smart Insights**
   - AI analyzes your nutrition patterns
   - Personalized recommendations
   - Health correlations with wearable data
   - Examples:
     - "You're low on iron - add spinach or rajma"
     - "Sodium is high and your BP is elevated - try low-sodium options"
     - "Great protein intake! You're at 95% of your goal"

4. **Meal Timeline**
   - See all meals logged today
   - Time stamps and calorie counts
   - Quick overview of eating patterns

## Indian Food Database

### Foods Included

**Grains & Bread**
- Chapati, Roti, Phulka
- White Rice, Brown Rice
- Paratha (plain, aloo)
- Dosa, Masala Dosa
- Idli
- Poha, Upma

**Pulses & Legumes**
- Dal Tadka (Toor Dal)
- Rajma (Kidney Beans)
- Chickpeas (Chana Masala, Chole)
- Moong Sprouts

**Protein**
- Paneer (Cottage Cheese)
- Palak Paneer
- Chicken Curry, Chicken Tikka, Butter Chicken
- Fish Curry
- Eggs (Boiled, Omelette)

**Vegetables**
- Spinach (Palak)
- Mixed Vegetable Curry (Sabzi)
- Tomato
- Salad (Mixed, Garden)

**Rice Dishes**
- Biryani (Chicken, Vegetable)
- Pulao
- Khichdi

**Snacks**
- Samosa
- Pakora
- Vada

**Breakfast**
- Oats Porridge
- Smoothie Bowl
- Quinoa

**Dairy**
- Curd (Yogurt, Dahi)
- Milk

**Fruits**
- Banana
- Apple

**Desserts**
- Gulab Jamun
- Rasgulla

### Portion Sizes

Standard Indian portions included:
- **Katori** (Bowl): 100-150g (dal, curry, rice)
- **Plate**: 200-250g (biryani, rice)
- **Piece**: Individual items (chapati, samosa, idli)
- **Visual Guides**: Palm, Fist, Thumb sizes

## Using the API

### Nutrition Lookup Endpoint

**URL**: `/api/nutrition-lookup?q=<food_name>`

**Example Request**:
```
GET /api/nutrition-lookup?q=paneer
```

**Example Response**:
```json
{
  "found": true,
  "name": "Paneer",
  "source": "Indian Foods DB",
  "tier": 1,
  "category": "dairy",
  "serving": "50g (3-4 cubes)",
  "macros": {
    "per": "100g",
    "kcal": 265,
    "protein_g": 18.3,
    "carbs_g": 1.2,
    "fat_g": 20.8,
    "fiber_g": 0,
    "sodium_mg": 18
  },
  "micros": {
    "calcium_mg": 480,
    "phosphorus_mg": 245,
    "vitamin_a_mcg": 210,
    "vitamin_b12_mcg": 0.3
  }
}
```

**Response Fields**:
- `found`: Boolean - whether food was found
- `name`: Food name
- `source`: Data source (Indian Foods DB, USDA, OpenFoodFacts, Estimated)
- `tier`: Priority tier (1-4, lower is better)
- `macros`: Macronutrient data per 100g
- `micros`: Micronutrient data per 100g
- `estimated`: Boolean (only present if estimation was used)
- `confidence`: "low" (only present if estimation was used)

## Competitive Advantages

### How We Compare to Competitors

| Feature | Healthy Diet | Healthify | MyFitnessPal |
|---------|--------------|-----------|--------------|
| Indian Food Database | ✅ 40+ verified | ✅ 100k+ | ⚠️ Limited |
| Multi-Tier Lookup | ✅ 4 tiers | ❌ Single | ✅ 2 tiers |
| Offline Support | ✅ Tier 1 | ❌ | ❌ |
| Micronutrient Tracking | ✅ 6 key nutrients | ✅ Premium | ✅ Premium |
| Wearable Integration | ✅ Real-time | ✅ Premium | ✅ Premium |
| Free Forever | ✅ | ⚠️ Trial only | ⚠️ Limited |
| AI Insights | ✅ | ✅ Premium | ❌ |
| Privacy First | ✅ Local data | ⚠️ Cloud | ⚠️ Cloud |

### Our Unique Features

1. **Hyper-Local Indian Food Intelligence**
   - Regional cuisine variants
   - Home-cooked meal templates
   - Festival food tracking

2. **Wearable-First Nutrition**
   - Real-time calorie adjustment based on activity
   - BP-aware sodium recommendations
   - Heart rate-based meal timing

3. **Vendor Integration with Health Scoring**
   - Real restaurant dishes with nutrition
   - Health scores for delivery menu items
   - Modification suggestions

4. **Privacy-First Approach**
   - All data stored locally
   - No cloud sync required
   - You control your data

## Tips for Best Results

### 1. Search Tips

- **Use common names**: "dal" instead of "lentils"
- **Try aliases**: Both "cottage cheese" and "paneer" work
- **Be specific**: "chicken tikka" vs just "chicken"
- **Use Indian terms**: "rajma" is better than "kidney beans curry"

### 2. Understanding Tiers

- **Tier 1** (Local DB): Most accurate, verified data
- **Tier 2** (USDA): Very accurate for international foods
- **Tier 3** (OpenFoodFacts): Good for packaged foods
- **Tier 4** (Estimated): Use with caution, check "confidence"

### 3. Customizing Goals

Goals are based on average adult needs:
- **Calories**: 2000 kcal (adjust based on activity level)
- **Protein**: 50g (0.8g per kg body weight)
- **Carbs**: 250g (45-65% of calories)
- **Fat**: 65g (20-35% of calories)

Coming soon: Personalized goals based on your profile!

### 4. Interpreting Insights

Dashboard insights use your wearable data:
- **Sodium warnings** appear when BP is elevated
- **Protein recommendations** after high activity
- **Iron alerts** for patterns suggesting deficiency
- **Balance tips** for macro distribution

## Troubleshooting

### Issue: Food Not Found

**Solution**:
1. Try alternative names (e.g., "yogurt" instead of "curd")
2. Check spelling
3. System will estimate if no match found
4. Look for similar foods in the database

### Issue: Inaccurate Nutrition Data

**Solution**:
1. Check the "source" field - Tier 1 is most accurate
2. For estimated values, use with caution
3. Report issues so we can add to local database
4. Cross-reference with package labels when possible

### Issue: Dashboard Not Updating

**Solution**:
1. Click "Refresh" button
2. Check that you're logging meals
3. Clear browser cache if needed
4. Data resets daily at midnight

## Future Roadmap

### Coming Soon

**Phase 1** (Week 1-2):
- ✅ Multi-tier nutrition lookup
- ✅ Indian food database
- ✅ Nutrition dashboard
- ⏳ Meal logging feature
- ⏳ Enhanced caching

**Phase 2** (Week 3-4):
- ⏳ Barcode scanner
- ⏳ Photo-based food logging
- ⏳ Recipe nutrition calculator
- ⏳ Custom portion sizes

**Phase 3** (Week 5-6):
- ⏳ Challenges & gamification
- ⏳ Weekly reports
- ⏳ Social sharing
- ⏳ Nutritionist consultation

**Phase 4** (Week 7+):
- ⏳ Advanced health conditions support
- ⏳ Meal planning
- ⏳ Shopping lists
- ⏳ Restaurant API integration

## Support

For questions, issues, or feature requests:
1. Check this guide first
2. Review the main README
3. Open a GitHub issue
4. Contact support

## Privacy & Data

- All nutrition data stored locally in browser
- No personal data sent to servers
- API calls for nutrition lookup only send food names
- Wearable data never leaves your device
- You can export your data anytime

## Credits

**Data Sources**:
- Indian Food Composition Tables (IFCT) 2017
- National Institute of Nutrition (NIN) Database
- USDA FoodData Central
- OpenFoodFacts Community

**Built with**:
- Vanilla JavaScript (no dependencies)
- Netlify Functions (serverless)
- LocalStorage (privacy-first)
- Modern CSS (responsive design)

---

**Version**: 1.0.0
**Last Updated**: 2025-11-17
**License**: MIT
