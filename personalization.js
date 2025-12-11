/**
 * personalization.js - Personalization engine for ACL025 nutrition coach
 * 
 * Provides smart defaults and daily target calculations based on wearable data,
 * user profile, and common health patterns. Designed to work with minimal input
 * and gracefully handle missing data.
 * 
 * Key features:
 * - Derives approximate daily targets from basic data (age, sex, weight, activity)
 * - Time-aware adjustments for meal recommendations
 * - Health alignment scoring based on current vitals
 * - Risk flag detection for health concerns
 */

/**
 * Default profile values when user data is incomplete
 * These are safe mid-ranges for a typical adult
 */
const DEFAULT_PROFILE = {
  age: 32,
  sex: 'unknown',
  weightKg: 70,
  heightCm: 165,
  activityLevel: 'moderate', // low, moderate, high
  goal: 'maintain', // maintain, lose, gain
};

/**
 * Build a complete user profile with smart defaults
 * @param {Object} wearable - Wearable data stream
 * @param {Object} preferences - User preferences from localStorage
 * @returns {Object} Complete profile with all required fields
 */
function buildUserProfile(wearable = {}, preferences = {}) {
  const profile = { ...DEFAULT_PROFILE };
  
  // Extract any available data from wearable
  if (wearable.analysis?.activityLevel) {
    profile.activityLevel = wearable.analysis.activityLevel.toLowerCase();
  }
  
  // Infer activity level from steps or calories burned
  if (wearable.steps != null) {
    if (wearable.steps < 3000) profile.activityLevel = 'low';
    else if (wearable.steps > 8000) profile.activityLevel = 'high';
    else profile.activityLevel = 'moderate';
  } else if (wearable.caloriesBurned != null) {
    if (wearable.caloriesBurned < 300) profile.activityLevel = 'low';
    else if (wearable.caloriesBurned > 600) profile.activityLevel = 'high';
    else profile.activityLevel = 'moderate';
  }
  
  // Use preferences if available
  if (preferences.goal) profile.goal = preferences.goal;
  if (preferences.age) profile.age = preferences.age;
  if (preferences.sex) profile.sex = preferences.sex;
  if (preferences.weightKg) profile.weightKg = preferences.weightKg;
  if (preferences.heightCm) profile.heightCm = preferences.heightCm;
  
  return profile;
}

/**
 * Calculate daily nutritional targets based on profile
 * Uses a simplified version of Harris-Benedict equation + activity multipliers
 * 
 * @param {Object} profile - User profile (from buildUserProfile)
 * @returns {Object} Daily targets for calories, protein, carbs, fat, sodium, fiber
 */
function calculateDailyTargets(profile) {
  const { age, sex, weightKg, heightCm, activityLevel, goal } = profile;
  
  // Base metabolic rate (simplified Harris-Benedict)
  let bmr;
  if (sex === 'male') {
    bmr = 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age);
  } else if (sex === 'female') {
    bmr = 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age);
  } else {
    // Unknown sex - use average
    bmr = 267.978 + (11.322 * weightKg) + (3.949 * heightCm) - (5.004 * age);
  }
  
  // Activity multiplier
  const activityMultipliers = {
    low: 1.2,
    moderate: 1.55,
    high: 1.9
  };
  const multiplier = activityMultipliers[activityLevel] || 1.55;
  
  // Total daily energy expenditure
  let tdee = bmr * multiplier;
  
  // Adjust for goal
  if (goal === 'lose') tdee *= 0.85; // 15% deficit
  else if (goal === 'gain') tdee *= 1.1; // 10% surplus
  
  // Calculate macros (standard ratios)
  const protein_g = weightKg * 1.6; // 1.6g per kg body weight
  const fat_g = (tdee * 0.25) / 9; // 25% of calories from fat
  const carbs_g = (tdee - (protein_g * 4) - (fat_g * 9)) / 4; // Remaining from carbs
  
  // Micronutrients
  const sodium_mg = 2300; // Standard recommended maximum
  const fiber_g = 25; // Standard daily recommendation
  
  return {
    calories: Math.round(tdee),
    protein_g: Math.round(protein_g),
    carbs_g: Math.round(carbs_g),
    fat_g: Math.round(fat_g),
    sodium_mg: Math.round(sodium_mg),
    fiber_g: Math.round(fiber_g)
  };
}

/**
 * Compute how well a dish matches remaining daily targets
 * Returns normalized scores and fit label
 * 
 * @param {Object} dishMacros - Nutrition info for the dish (per 100g)
 * @param {Object} dailyTargets - Daily nutritional targets
 * @param {Object} consumedToday - Already consumed nutrition (optional)
 * @param {number} servingSize - Estimated serving size in grams (default 200g)
 * @returns {Object} { macroFitScore, label, breakdown }
 */
function computeMacroFit(dishMacros, dailyTargets, consumedToday = {}, servingSize = 200) {
  if (!dishMacros) return { macroFitScore: 0.5, label: 'OK', breakdown: {} };
  
  // Scale dish macros to serving size
  const scaleFactor = servingSize / 100;
  const dishScaled = {
    kcal: (dishMacros.kcal || 0) * scaleFactor,
    protein_g: (dishMacros.protein_g || 0) * scaleFactor,
    carbs_g: (dishMacros.carbs_g || 0) * scaleFactor,
    fat_g: (dishMacros.fat_g || 0) * scaleFactor,
    sodium_mg: (dishMacros.sodium_mg || 0) * scaleFactor,
    fiber_g: (dishMacros.fiber_g || 0) * scaleFactor,
  };
  
  // Calculate remaining targets
  const remaining = {
    calories: dailyTargets.calories - (consumedToday.calories || 0),
    protein_g: dailyTargets.protein_g - (consumedToday.protein_g || 0),
    carbs_g: dailyTargets.carbs_g - (consumedToday.carbs_g || 0),
    fat_g: dailyTargets.fat_g - (consumedToday.fat_g || 0),
    sodium_mg: dailyTargets.sodium_mg - (consumedToday.sodium_mg || 0),
  };
  
  // Calculate fit for each macro (0-1 scale, 1 = perfect fit)
  const caloriesFit = 1 - Math.abs(dishScaled.kcal - (remaining.calories * 0.3)) / (dailyTargets.calories * 0.5);
  const proteinFit = Math.min(dishScaled.protein_g / (remaining.protein_g * 0.3), 1);
  const sodiumFit = 1 - (dishScaled.sodium_mg / remaining.sodium_mg);
  
  // Weight the components
  const macroFitScore = Math.max(0, Math.min(1,
    caloriesFit * 0.4 + proteinFit * 0.35 + sodiumFit * 0.25
  ));
  
  // Determine label
  let label = 'OK';
  if (macroFitScore >= 0.7) label = 'Good';
  else if (macroFitScore < 0.4) label = 'Caution';
  
  return {
    macroFitScore,
    label,
    breakdown: {
      caloriesFit: Math.round(caloriesFit * 100),
      proteinFit: Math.round(proteinFit * 100),
      sodiumFit: Math.round(sodiumFit * 100)
    }
  };
}

/**
 * Compute health alignment flags and boost reasons
 * This is the lightweight rules engine for personalized recommendations
 * 
 * @param {Object} dish - Dish object with tags and macros
 * @param {Object} wearable - Current wearable vitals
 * @param {Object} profileTags - Profile tags and medical flags
 * @param {Object} timeContext - Time of day context
 * @returns {Object} { fitLabel, reasons, riskFlags, boostReasons }
 */
function computeHealthAlignment(dish, wearable, profileTags, timeContext = {}) {
  const tags = dish.tags || [];
  const macros = dish.macros || {};
  const medicalFlags = profileTags?.medical_flags || [];
  const userTags = profileTags?.tags || [];
  
  const riskFlags = [];
  const boostReasons = [];
  const reasons = [];
  
  // Get time of day
  const hour = timeContext.hour || new Date().getHours();
  const isEvening = hour >= 18;
  const isLateNight = hour >= 21;
  
  // Risk detection: High sodium + elevated BP
  if ((medicalFlags.includes('high-bp') || medicalFlags.includes('elevated-bp'))) {
    const sodiumMg = (macros.sodium_mg || 0) * 2; // Estimate for serving
    if (sodiumMg > 800 || tags.includes('high-sodium')) {
      riskFlags.push('High sodium for your blood pressure');
    } else if (tags.includes('low-sodium')) {
      boostReasons.push('Low sodium - good for your BP');
    }
  }
  
  // Risk detection: Heavy meal + low activity
  if (medicalFlags.includes('low-activity')) {
    const calories = (macros.kcal || 0) * 2; // Estimate for serving
    if (calories > 500 && !tags.includes('light-clean')) {
      riskFlags.push('Heavy meal for low activity day');
    } else if (tags.includes('light-clean') || tags.includes('low-calorie')) {
      boostReasons.push('Light meal - matches your activity level');
    }
  }
  
  // Risk detection: Heavy meal late at night
  if (isLateNight) {
    const calories = (macros.kcal || 0) * 2;
    if (calories > 400 && !tags.includes('light-clean')) {
      riskFlags.push('Heavy for late evening');
    }
  }
  
  // Boost detection: High protein + high activity
  if (medicalFlags.includes('high-activity') || (wearable.caloriesBurned || 0) > 400) {
    if (tags.includes('high-protein') || tags.includes('high-protein-snack')) {
      boostReasons.push('High protein - great after your active day');
    } else {
      const protein = (macros.protein_g || 0) * 2;
      if (protein < 15) {
        reasons.push('Consider higher protein after active day');
      }
    }
  }
  
  // Boost detection: Tag alignment
  const matchedTags = tags.filter(t => userTags.includes(t));
  if (matchedTags.length > 0) {
    const tagStr = matchedTags.slice(0, 2).join(', ');
    boostReasons.push(`Matches your ${tagStr} preference`);
  }
  
  // Determine overall fit label
  let fitLabel = 'OK';
  if (boostReasons.length >= 2 && riskFlags.length === 0) {
    fitLabel = 'Good';
  } else if (riskFlags.length >= 2 || (riskFlags.length >= 1 && boostReasons.length === 0)) {
    fitLabel = 'Caution';
  } else if (boostReasons.length >= 1 && riskFlags.length === 0) {
    fitLabel = 'Good';
  }
  
  return {
    fitLabel,
    reasons: reasons.slice(0, 2),
    riskFlags: riskFlags.slice(0, 2),
    boostReasons: boostReasons.slice(0, 2)
  };
}

/**
 * Get today's wellness focus based on profile and time
 * Returns a short, friendly message for the UI
 * 
 * @param {Object} profileTags - Profile tags and medical flags
 * @param {Object} wearable - Current wearable vitals
 * @returns {string} Wellness focus message
 */
function getWellnessFocus(profileTags, wearable) {
  const medicalFlags = profileTags?.medical_flags || [];
  const userTags = profileTags?.tags || [];
  const hour = new Date().getHours();
  
  // Time-based focus
  let mealType = 'meals';
  if (hour < 11) mealType = 'breakfast';
  else if (hour < 15) mealType = 'lunch';
  else if (hour < 20) mealType = 'dinner';
  else mealType = 'light snacks';
  
  // Priority 1: Medical flags
  if (medicalFlags.includes('high-bp') || medicalFlags.includes('elevated-bp')) {
    return `Focus: low-sodium ${mealType}`;
  }
  
  if (medicalFlags.includes('high-activity') || (wearable.caloriesBurned || 0) > 500) {
    return `Focus: protein-rich ${mealType} after active day`;
  }
  
  if (medicalFlags.includes('low-activity')) {
    return `Focus: light, clean ${mealType}`;
  }
  
  // Priority 2: User tags
  if (userTags.length >= 2) {
    const focus = userTags.slice(0, 2).join(' + ');
    return `Focus: ${focus} ${mealType}`;
  }
  
  // Default
  return `Focus: balanced, healthy ${mealType}`;
}

/**
 * Calculate nutrition confidence based on source tier
 * @param {number} tier - Nutrition lookup tier (1-4)
 * @param {string} source - Data source name
 * @returns {string} 'high' | 'medium' | 'low'
 */
function getMacroConfidence(tier, source) {
  if (!tier && !source) return 'low';
  
  // Tier-based (from nutrition-lookup.js)
  if (tier === 1) return 'high'; // Local DB
  if (tier === 2) return 'high'; // USDA
  if (tier === 3) return 'medium'; // OpenFoodFacts
  if (tier === 4) return 'low'; // Estimated
  
  // Source-based fallback
  if (source) {
    const s = source.toLowerCase();
    if (s.includes('indian foods db') || s.includes('usda') || s.includes('verified')) {
      return 'high';
    }
    if (s.includes('openfoodfacts') || s.includes('api')) {
      return 'medium';
    }
    if (s.includes('estimate')) {
      return 'low';
    }
  }
  
  return 'medium'; // Default
}

// Export all functions for use in app.js
if (typeof window !== 'undefined') {
  window.Personalization = {
    buildUserProfile,
    calculateDailyTargets,
    computeMacroFit,
    computeHealthAlignment,
    getWellnessFocus,
    getMacroConfidence
  };
}
