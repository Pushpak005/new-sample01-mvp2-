const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Collaborative Filtering Recommendation Engine
 * Based on user-user similarity and item-item similarity
 * Similar to Netflix, Amazon, Zomato algorithms
 */

/**
 * Calculate Cosine Similarity between two users
 * Based on their order history
 */
function cosineSimilarity(user1Orders, user2Orders) {
  const user1Dishes = new Set(user1Orders.map(o => o.dish_id));
  const user2Dishes = new Set(user2Orders.map(o => o.dish_id));
  
  // Find common dishes
  const commonDishes = new Set(
    [...user1Dishes].filter(d => user2Dishes.has(d))
  );
  
  if (commonDishes.size === 0) return 0;
  
  // Calculate cosine similarity
  const dotProduct = commonDishes.size;
  const magnitude1 = Math.sqrt(user1Dishes.size);
  const magnitude2 = Math.sqrt(user2Dishes.size);
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * User-based Collaborative Filtering
 * Find similar users and recommend what they liked
 */
async function getUserBasedRecommendations(userId, limit = 10) {
  // Get user's order history
  const { data: userOrders } = await supabase
    .from('orders')
    .select('dish_id, vendor_id, created_at')
    .eq('user_id', userId)
    .eq('status', 'delivered')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (!userOrders || userOrders.length === 0) {
    // New user - return popular items
    return getPopularItems(limit);
  }
  
  const userDishIds = userOrders.map(o => o.dish_id);
  
  // Find other users who ordered similar dishes
  const { data: similarUserOrders } = await supabase
    .from('orders')
    .select('user_id, dish_id')
    .in('dish_id', userDishIds)
    .neq('user_id', userId)
    .eq('status', 'delivered')
    .limit(500);
  
  if (!similarUserOrders || similarUserOrders.length === 0) {
    return getPopularItems(limit);
  }
  
  // Group orders by user
  const userOrdersMap = {};
  similarUserOrders.forEach(order => {
    if (!userOrdersMap[order.user_id]) {
      userOrdersMap[order.user_id] = [];
    }
    userOrdersMap[order.user_id].push(order);
  });
  
  // Calculate similarity scores
  const similarities = Object.entries(userOrdersMap).map(([otherId, otherOrders]) => ({
    user_id: otherId,
    similarity: cosineSimilarity(userOrders, otherOrders),
    order_count: otherOrders.length
  }));
  
  // Sort by similarity
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Get top 10 similar users
  const topSimilarUsers = similarities.slice(0, 10).map(s => s.user_id);
  
  // Get dishes ordered by similar users (but not by current user)
  const { data: recommendedDishes } = await supabase
    .from('orders')
    .select(`
      dish_id,
      vendor_menu!inner(
        dish_id,
        name,
        description,
        price,
        category,
        health_tags,
        nutrition_info,
        vendor_id,
        vendors!inner(name, area, rating)
      )
    `)
    .in('user_id', topSimilarUsers)
    .not('dish_id', 'in', `(${userDishIds.join(',')})`)
    .eq('status', 'delivered');
  
  // Count frequency of each dish
  const dishFrequency = {};
  recommendedDishes?.forEach(order => {
    const dishId = order.dish_id;
    if (!dishFrequency[dishId]) {
      dishFrequency[dishId] = {
        count: 0,
        dish: order.vendor_menu
      };
    }
    dishFrequency[dishId].count++;
  });
  
  // Sort by frequency and return top recommendations
  const recommendations = Object.values(dishFrequency)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(item => ({
      ...item.dish,
      recommendation_score: item.count,
      recommendation_reason: `${item.count} similar users loved this`,
      algorithm: 'collaborative_filtering'
    }));
  
  return recommendations;
}

/**
 * Item-based Collaborative Filtering
 * Find similar dishes based on co-purchase patterns
 */
async function getItemBasedRecommendations(dishId, limit = 10) {
  // Get users who ordered this dish
  const { data: usersWhoOrdered } = await supabase
    .from('orders')
    .select('user_id')
    .eq('dish_id', dishId)
    .eq('status', 'delivered');
  
  if (!usersWhoOrdered || usersWhoOrdered.length === 0) {
    return [];
  }
  
  const userIds = usersWhoOrdered.map(o => o.user_id);
  
  // Get other dishes ordered by these users
  const { data: relatedOrders } = await supabase
    .from('orders')
    .select(`
      dish_id,
      vendor_menu!inner(
        dish_id,
        name,
        description,
        price,
        category,
        health_tags,
        nutrition_info,
        vendor_id
      )
    `)
    .in('user_id', userIds)
    .neq('dish_id', dishId)
    .eq('status', 'delivered');
  
  // Count co-occurrences
  const coOccurrence = {};
  relatedOrders?.forEach(order => {
    const relatedDishId = order.dish_id;
    if (!coOccurrence[relatedDishId]) {
      coOccurrence[relatedDishId] = {
        count: 0,
        dish: order.vendor_menu
      };
    }
    coOccurrence[relatedDishId].count++;
  });
  
  // Calculate "people also ordered" score
  const totalUsers = userIds.length;
  const recommendations = Object.values(coOccurrence)
    .map(item => ({
      ...item.dish,
      recommendation_score: (item.count / totalUsers) * 100,
      recommendation_reason: `${Math.round((item.count / totalUsers) * 100)}% who ordered this also ordered that`,
      algorithm: 'item_based_filtering'
    }))
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    .slice(0, limit);
  
  return recommendations;
}

/**
 * Content-based Filtering
 * Recommend based on dish attributes and user preferences
 */
async function getContentBasedRecommendations(userId, limit = 10) {
  // Get user's order history to understand preferences
  const { data: userOrders } = await supabase
    .from('orders')
    .select(`
      vendor_menu!inner(
        category,
        health_tags,
        nutrition_info,
        price
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'delivered')
    .limit(20);
  
  if (!userOrders || userOrders.length === 0) {
    return getPopularItems(limit);
  }
  
  // Extract user preferences
  const preferences = {
    categories: {},
    healthTags: {},
    avgPrice: 0
  };
  
  let totalPrice = 0;
  userOrders.forEach(order => {
    const menu = order.vendor_menu;
    
    // Category preference
    if (menu.category) {
      preferences.categories[menu.category] = 
        (preferences.categories[menu.category] || 0) + 1;
    }
    
    // Health tags preference
    if (menu.health_tags) {
      menu.health_tags.forEach(tag => {
        preferences.healthTags[tag] = 
          (preferences.healthTags[tag] || 0) + 1;
      });
    }
    
    totalPrice += menu.price || 0;
  });
  
  preferences.avgPrice = totalPrice / userOrders.length;
  
  // Find top preferences
  const topCategory = Object.entries(preferences.categories)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  
  const topHealthTags = Object.entries(preferences.healthTags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);
  
  // Find dishes matching preferences
  let query = supabase
    .from('vendor_menu')
    .select('*')
    .eq('is_available', true);
  
  if (topCategory) {
    query = query.eq('category', topCategory);
  }
  
  // Price range: ±30% of average
  const priceMin = preferences.avgPrice * 0.7;
  const priceMax = preferences.avgPrice * 1.3;
  query = query.gte('price', priceMin).lte('price', priceMax);
  
  const { data: matchingDishes } = await query.limit(50);
  
  // Score dishes based on matching tags
  const recommendations = matchingDishes?.map(dish => {
    let score = 50; // Base score
    
    // Boost for matching health tags
    if (dish.health_tags) {
      const matchingTags = dish.health_tags.filter(tag => 
        topHealthTags.includes(tag)
      );
      score += matchingTags.length * 20;
    }
    
    // Boost for category match
    if (dish.category === topCategory) {
      score += 30;
    }
    
    return {
      ...dish,
      recommendation_score: score,
      recommendation_reason: `Matches your taste: ${topCategory || 'your favorites'}`,
      algorithm: 'content_based'
    };
  })
  .sort((a, b) => b.recommendation_score - a.recommendation_score)
  .slice(0, limit);
  
  return recommendations || [];
}

/**
 * Get popular items (fallback for new users)
 */
async function getPopularItems(limit = 10) {
  const { data: popularDishes } = await supabase
    .from('orders')
    .select(`
      dish_id,
      vendor_menu!inner(*)
    `)
    .eq('status', 'delivered')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
    .limit(200);
  
  // Count frequency
  const dishCount = {};
  popularDishes?.forEach(order => {
    const dishId = order.dish_id;
    if (!dishCount[dishId]) {
      dishCount[dishId] = {
        count: 0,
        dish: order.vendor_menu
      };
    }
    dishCount[dishId].count++;
  });
  
  const recommendations = Object.values(dishCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(item => ({
      ...item.dish,
      recommendation_score: item.count,
      recommendation_reason: `Trending - ordered ${item.count} times this week`,
      algorithm: 'popularity_based'
    }));
  
  return recommendations;
}

/**
 * Hybrid Recommendation
 * Combines multiple algorithms for best results
 */
async function getHybridRecommendations(userId, limit = 10) {
  const [userBased, contentBased, popular] = await Promise.all([
    getUserBasedRecommendations(userId, 5),
    getContentBasedRecommendations(userId, 5),
    getPopularItems(5)
  ]);
  
  // Combine and deduplicate
  const allRecommendations = [...userBased, ...contentBased, ...popular];
  const uniqueRecommendations = Array.from(
    new Map(allRecommendations.map(item => [item.dish_id, item])).values()
  );
  
  // Sort by score and return top N
  return uniqueRecommendations
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    .slice(0, limit);
}

/**
 * API Handler
 */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const {
      user_id,
      algorithm = 'hybrid',
      dish_id,
      limit = 10
    } = JSON.parse(event.body || '{}');
    
    let recommendations;
    
    switch (algorithm) {
      case 'collaborative':
        recommendations = await getUserBasedRecommendations(user_id, limit);
        break;
      
      case 'content':
        recommendations = await getContentBasedRecommendations(user_id, limit);
        break;
      
      case 'item_based':
        if (!dish_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'dish_id required for item_based' })
          };
        }
        recommendations = await getItemBasedRecommendations(dish_id, limit);
        break;
      
      case 'popular':
        recommendations = await getPopularItems(limit);
        break;
      
      case 'hybrid':
      default:
        recommendations = await getHybridRecommendations(user_id, limit);
        break;
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        user_id,
        algorithm,
        count: recommendations.length,
        recommendations
      })
    };
  } catch (error) {
    console.error('Recommendation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        details: 'Recommendation engine failed'
      })
    };
  }
};
