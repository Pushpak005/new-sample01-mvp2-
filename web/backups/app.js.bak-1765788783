(() => {
/* Healthy Diet – Partner menus only
   - Today’s Picks come only from vendor_menus.json (Healthybee, Swad Gomantak, Shree Krishna Veg).
   - No /api/vendor-catalog.
   - No external recipe API.
   - Wearable + /api/profile-tags drive ranking.
   - Why + evidence + DeepSeek logic retained.
*/

const VENDOR_MENUS_URL  = "vendor_menus.json";
const WEARABLE_URL      = "wearable_stream.json";
const NUTRITIONISTS_URL = "nutritionists.json";

let state = {
  catalog: [], wearable: {}, page: 0, pageSize: 10, scores: [],
  model: loadModel(), recomputeTimer: null, wearableTimer: null,
  macrosCache: loadCache("macrosCache"),
  tagStats: loadCache("tagStats"),
  nutritionists: [],
  evidenceCache: loadCache("evidenceCache"),
  profileTags: { tags: [], medical_flags: [], reasoning: '' },
  openWhyBoxes: new Set(), // Track which Why boxes are open
  userProfile: null, // User profile with smart defaults
  dailyTargets: null, // Daily nutritional targets
  consumedToday: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sodium_mg: 0 } // Track consumed nutrition
};

// -----------------------------------------------------------------------------
// Load vendor menus directly from vendor_menus.json
async function loadVendorMenus() {
  try {
    const data = await safeJson(VENDOR_MENUS_URL, null);
    if (!data || !Array.isArray(data.vendors)) {
      console.warn("vendor_menus.json missing or invalid");
      return;
    }
    const items = [];
    data.vendors.forEach(v => {
      (v.dishes || []).forEach(d => {
        items.push({
          ...d,
          vendorId: v.id,
          vendorName: v.name,
          vendorArea: v.area,
          vendorCity: v.city
        });
      });
    });
    if (!items.length) {
      console.warn("No dishes found in vendor_menus.json");
      return;
    }
    state.catalog = items;
    console.log(`Loaded ${items.length} dishes from vendor_menus.json`);
  } catch (e) {
    console.warn("Failed to load vendor_menus.json", e);
  }
}

// -----------------------------------------------------------------------------
// Profile tags via /api/profile-tags
async function fetchProfileTags() {
  try {
    const prefs = JSON.parse(localStorage.getItem('prefs') || '{}');
    const resp = await fetch('/api/profile-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vitals: state.wearable || {},
        preferences: prefs
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && Array.isArray(data.tags)) {
        state.profileTags = data;
        console.log('Profile tags:', data.tags.join(', '));
        console.log('Medical flags:', (data.medical_flags || []).join(', '));
        
        // Update user profile and daily targets
        updatePersonalization();
        return;
      }
    }
  } catch (e) {
    console.warn('Failed to fetch profile tags:', e);
  }
  state.profileTags = { tags: [], medical_flags: [], reasoning: '' };
  updatePersonalization();
}

// -----------------------------------------------------------------------------
// Update personalization based on current wearable and preferences
function updatePersonalization() {
  if (typeof window.Personalization === 'undefined') {
    console.warn('Personalization module not loaded');
    return;
  }
  
  const prefs = JSON.parse(localStorage.getItem('prefs') || '{}');
  state.userProfile = window.Personalization.buildUserProfile(state.wearable, prefs);
  state.dailyTargets = window.Personalization.calculateDailyTargets(state.userProfile);
  
  console.log('Daily targets:', state.dailyTargets);
  
  // Update wellness focus in UI
  updateWellnessFocus();
}

// -----------------------------------------------------------------------------
// Update wellness focus strip (removed - no longer shown in UI)
function updateWellnessFocus() {
  // Wellness focus strip has been removed from UI
  // Keeping this function stub for backward compatibility
}

// -----------------------------------------------------------------------------
// Entry point
window.APP_BOOT = async function(){
  // clock
  setInterval(() => {
    const d = new Date(); const el = document.getElementById('clock');
    if (el) el.textContent = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  }, 1000);

  // buttons
  byId('toggleDetails')?.addEventListener('click', () => {
    const box = byId('healthDetails'); box.hidden = !box.hidden;
    byId('toggleDetails').textContent = box.hidden ? 'More Health Details ▾' : 'Hide Health Details ▴';
  });
  byId('reshuffle')?.addEventListener('click', () => recompute(true));
  byId('getPicks')?.addEventListener('click', async () => {
    await pullWearable();
    await fetchProfileTags();
    await loadVendorMenus();
    recompute(true);
  });
  byId('prevBtn')?.addEventListener('click', () => {
    if (state.page > 0) { state.page--; renderCards(); }
  });
  byId('nextBtn')?.addEventListener('click', () => {
    const max = Math.max(0, Math.ceil(state.scores.length/state.pageSize) - 1);
    if (state.page < max) { state.page++; renderCards(); }
  });

  // nutritionists (if used)
  state.nutritionists = await safeJson(NUTRITIONISTS_URL, []);

  // initial data
  await pullWearable();
  await fetchProfileTags();
  await loadVendorMenus();

  // wearable polling
  state.wearableTimer = setInterval(pullWearable, 15 * 60 * 1000);

  function simulateWearableChanges(){
    const w = state.wearable || {};
    if (w.heartRate != null) {
      w.heartRate = Math.max(50, Math.min(120, w.heartRate + Math.floor(Math.random()*9 - 4)));
    }
    if (w.caloriesBurned != null) {
      w.caloriesBurned = Math.max(0, w.caloriesBurned + Math.floor(Math.random()*101 - 50));
    }
    if (w.bpSystolic != null) {
      w.bpSystolic = Math.max(90, Math.min(160, w.bpSystolic + Math.floor(Math.random()*7 - 3)));
    }
    if (w.bpDiastolic != null) {
      w.bpDiastolic = Math.max(60, Math.min(100, w.bpDiastolic + Math.floor(Math.random()*5 - 2)));
    }
    if (w.analysis && w.analysis.activityLevel) {
      const levels = ['low','moderate','high'];
      w.analysis.activityLevel = levels[Math.floor(Math.random()*levels.length)];
    }
    state.wearable = w;
    paintHealth(w);
    fetchProfileTags().then(() => recompute());
  }
  setInterval(simulateWearableChanges, 30 * 1000);

  scheduleRecomputeFromPrefs();
  recompute(true);
};

// ---------- helpers ----------
function byId(id){ return document.getElementById(id); }
async function safeJson(url, fallback){
  try{
    const r = await fetch(url);
    if(!r.ok) throw new Error(r.status);
    return await r.json();
  } catch(e){
    console.warn('Fetch failed', url, e);
    return fallback;
  }
}
function loadCache(key){
  try{ return JSON.parse(localStorage.getItem(key) || '{}'); } catch(_){ return {}; }
}
function saveCache(key, data){ localStorage.setItem(key, JSON.stringify(data)); }
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/**
 * Map tag keys to human-friendly health badge labels
 * Used to display clear health indicators on dish cards
 */
function getHealthTagLabel(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return '';
  
  // Priority mapping - show the most relevant health tag
  const tagLabelMap = {
    'high-protein': 'High protein',
    'high-protein-snack': 'High protein',
    'low-sodium': 'Low sodium',
    'light-clean': 'Light meal',
    'low-calorie': 'Light meal',
    'high-fiber': 'High fiber',
    'iron-rich': 'Iron rich',
    'satvik': 'Satvik',
    'balanced-meal': 'Balanced'
  };
  
  // Find first matching tag in priority order
  for (const tag of tags) {
    if (tagLabelMap[tag]) {
      return tagLabelMap[tag];
    }
  }
  
  return '';
}

// ---------- wearable ----------
async function pullWearable(){
  const w = await safeJson(WEARABLE_URL, state.wearable || {});
  state.wearable = w;
  paintHealth(w);
  recompute(false);
}
function paintHealth(w){
  const set = (id, v) => { const el = byId(id); if (el) el.textContent = v; };
  set('m-hr', w.heartRate ?? '–');
  set('m-steps', w.steps ?? '–');
  set('m-cals', w.calories ?? '–');
  set('d-burned', w.caloriesBurned ?? '–');
  set('d-bp', (w.bpSystolic && w.bpDiastolic) ? `${w.bpSystolic}/${w.bpDiastolic}` : '–');
  set('d-activity', w.analysis?.activityLevel ?? '–');
  set('d-time', w.timestamp ? new Date(w.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString());
  const ds = byId('data-source'); if(ds) ds.textContent = 'wearable_stream.json (demo)';
  const highRisk = (w.bpSystolic||0) >= 140 || (w.bpDiastolic||0) >= 90 || (w.bloodSugar||0) >= 180;
  const banner = byId('riskBanner');
  if(!banner) return;
  if(highRisk){
    banner.hidden = false;
    banner.innerHTML = '⚠️ Health Alert — Please consult a doctor for personalized guidance.' +
      '<br/><a id="healthCollabLink" class="pill" href="https://www.fitpage.in" target="_blank" rel="noopener">Consult Partner</a>';
  } else {
    banner.hidden = true;
    banner.innerHTML = '⚠️ Your vitals suggest a high-risk pattern. Please prefer light, low-sodium items or request a human review.';
  }
}

// ---------- recompute ----------
function scheduleRecomputeFromPrefs(){
  if(state.recomputeTimer) clearInterval(state.recomputeTimer);
  const prefs = JSON.parse(localStorage.getItem('prefs') || '{}');
  const minutes = (typeof prefs.updateInterval === 'number') ? prefs.updateInterval : 60;
  if(minutes > 0){ state.recomputeTimer = setInterval(() => recompute(true), minutes * 60 * 1000); }
}

function recompute(resetPage=false){
  const prefs = JSON.parse(localStorage.getItem('prefs') || '{}');
  
  // Log catalog size for debugging
  console.log(`[Recompute] Starting with ${state.catalog.length} items in catalog`);
  
  const filtered = state.catalog.filter(item => {
    if(prefs.diet === 'veg' && item.type !== 'veg') return false;
    if(prefs.diet === 'nonveg' && item.type !== 'nonveg') return false;
    if(prefs.satvik && !(item.tags||[]).includes('satvik')) return false;
    return true;
  });
  
  console.log(`[Recompute] After diet filtering: ${filtered.length} items`);
  
  // Score all items first
  const scored = filtered.map(item => ({ item, score: scoreItem(item) }));
  
  // Sort by score descending - show all items, not just "Good" fit
  // Items with "Good" fit label will naturally rank higher due to scoring boost
  state.scores = scored.sort((a, b) => b.score - a.score);
  
  console.log(`[Recompute] Final scored items: ${state.scores.length}`);
  
  if(resetPage) state.page = 0;
  renderCards();
}

function scoreItem(item){
  let s = 0; const tags = item.tags || []; const w = state.wearable || {};

  tags.forEach(t => s += (state.model[t] || 0));

  const profileTags = state.profileTags?.tags || [];
  tags.forEach(tag => { if (profileTags.includes(tag)) s += 12; });

  const medicalFlags = state.profileTags?.medical_flags || [];
  if (medicalFlags.includes('high-bp') || medicalFlags.includes('elevated-bp')) {
    if (!tags.includes('low-sodium') && tags.includes('high-sodium')) s -= 8;
  }
  if (medicalFlags.includes('low-activity')) {
    if (!tags.includes('light-clean') && !tags.includes('low-calorie')) s -= 4;
  }

  if((w.caloriesBurned||0) > 400 && tags.includes('high-protein-snack')) s += 8;
  if(((w.bpSystolic||0) >= 130 || (w.bpDiastolic||0) >= 80) && tags.includes('low-sodium')) s += 10;
  if(((w.analysis?.activityLevel||'').toLowerCase()) === 'low' && tags.includes('light-clean')) s += 6;

  s += Math.random() * 1.5;

  tags.forEach(tag => {
    const stats = state.tagStats[tag] || { shown: 0, success: 0 };
    const banditScore = (stats.success + 1) / (stats.shown + 2);
    s += banditScore * 4;
  });

  if (item.llmScore != null) s += (item.llmScore * 2);
  
  // Add health alignment score if personalization is available
  if (typeof window.Personalization !== 'undefined' && item.macros && state.dailyTargets) {
    const alignment = window.Personalization.computeHealthAlignment(
      item, 
      state.wearable, 
      state.profileTags,
      { hour: new Date().getHours() }
    );
    
    // Store alignment on item for UI rendering
    item.__healthAlignment = alignment;
    
    // Boost/penalize based on fit label
    if (alignment.fitLabel === 'Good') s += 8;
    else if (alignment.fitLabel === 'Caution') s -= 6;
    
    // Add macro fit score if available
    if (state.dailyTargets) {
      const macroFit = window.Personalization.computeMacroFit(
        item.macros, 
        state.dailyTargets,
        state.consumedToday
      );
      s += macroFit.macroFitScore * 5;
      item.__macroFit = macroFit;
    }
  }
  
  return s;
}

// ---------- LLM score ----------
async function fetchLlmScores(recipes) {
  const w = state.wearable || {};
  for (const item of recipes) {
    try {
      const resp = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vitals: w, macros: item.macros || {}, tags: item.tags || [], title: item.title || '' })
      });
      if (resp.ok) {
        const data = await resp.json();
        const n = Number(data.score);
        item.llmScore = isNaN(n) ? 0 : n;
      } else {
        item.llmScore = 0;
      }
    } catch (_e) {
      item.llmScore = 0;
    }
  }
}

// ---------- render ----------
async function renderCards(){
  const el = byId('cards'); if(!el) return;
  const start = state.page * state.pageSize;
  const slice = state.scores.slice(start, start + state.pageSize);
  await Promise.all(slice.map(({ item }) => ensureMacros(item)));
  slice.forEach(({ item }) => {
    (item.tags || []).forEach(t => {
      if(!state.tagStats[t]) state.tagStats[t] = { shown: 0, success: 0 };
      state.tagStats[t].shown += 1;
    });
  });
  saveCache('tagStats', state.tagStats);
  el.innerHTML = slice.map(({ item }) => cardHtml(item)).join('');
  slice.forEach(({ item }) => {
    const id = slug(item.title);
    byId(`why-${id}`)?.addEventListener('click', () => toggleWhy(item));
    byId(`like-${id}`)?.addEventListener('click', () => feedback(item, +1));
    byId(`skip-${id}`)?.addEventListener('click', () => feedback(item, -1));
    byId(`review-${id}`)?.addEventListener('click', () => {
      sessionStorage.setItem('reviewItem', JSON.stringify(item));
      window.location.href = 'review.html';
    });
    byId(`order-${id}`)?.addEventListener('click', () => openOrderModal(item));
    
    // Restore open Why boxes after re-render
    if (state.openWhyBoxes.has(item.title)) {
      const box = byId(`whybox-${id}`);
      if (box && item.__reasonHtml) {
        box.innerHTML = item.__reasonHtml;
        box.hidden = false;
      }
    }
  });
}

function cardHtml(item){
  const id = slug(item.title);
  const vendorLabel = item.vendorName
    ? `🏪 ${escapeHtml(item.vendorName)}${item.price ? ` • ₹${item.price}` : ''}`
    : '';
  const q = `${item.title} healthy`;
  const searchUrl = `https://www.swiggy.com/search?q=${encodeURIComponent(q)}`;
  
  // Build fit label badge - Only show "Best fit" for Good items
  let fitBadge = '';
  if (item.__healthAlignment && item.__healthAlignment.fitLabel === 'Good') {
    fitBadge = `<span class="fit-badge" style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-left: 8px;">Best fit</span>`;
  }
  
  // Build one-line health summary using clear tag labels
  let healthSummary = '';
  const healthTag = getHealthTagLabel(item.tags || []);
  if (healthTag) {
    healthSummary = `<div class="health-summary" style="color: #6b7280; font-size: 13px; margin-top: 6px;">
      <span style="display: inline-block; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-weight: 500;">${healthTag}</span>
    </div>`;
  }
  
  // Build confidence indicator
  let confidenceLabel = '';
  if (item.macrosConfidence) {
    const confIcons = {
      'high': '✓',
      'medium': '~',
      'low': '?'
    };
    const confColors = {
      'high': '#10b981',
      'medium': '#f59e0b',
      'low': '#6b7280'
    };
    const icon = confIcons[item.macrosConfidence] || '?';
    const color = confColors[item.macrosConfidence] || '#6b7280';
    confidenceLabel = `<span style="color: ${color}; font-size: 11px; margin-left: 6px;" title="Nutrition data confidence: ${item.macrosConfidence}">${icon} ${item.macrosConfidence}</span>`;
  }
  
  return `
    <li class="card">
      <div class="tile">${escapeHtml(item.hero || item.title)}</div>
      <div class="row-between mt8">
        <h4>${escapeHtml(item.title)}${fitBadge}</h4>
        <div class="btn-group">
          <button class="chip" id="like-${id}" title="Like">♥</button>
          <button class="chip" id="skip-${id}" title="Skip">⨯</button>
        </div>
      </div>
      ${vendorLabel ? `<div class="muted small mt4">${vendorLabel}${confidenceLabel}</div>` : (confidenceLabel ? `<div class="muted small mt4">Nutrition estimate${confidenceLabel}</div>` : '')}
      ${healthSummary}
      <div class="row gap8 mt6">
        <button class="pill ghost" id="why-${id}">ℹ Why?</button>
        <button class="pill ghost" id="review-${id}" title="Human review">👩‍⚕️ Review</button>
        <button class="pill" id="order-${id}">🛒 Order Now</button>
      </div>
      <div class="whybox" id="whybox-${id}" hidden></div>
    </li>`;
}

// ---------- Why explanation (heuristic + evidence + LLM) ----------
function buildWhyHtml(item){
  const w = state.wearable || {};
  const personas = ["our analysis"];
  const persona = personas[0];
  const reasons = [];

  const profileTags = state.profileTags?.tags || [];
  const medicalFlags = state.profileTags?.medical_flags || [];

  if (medicalFlags.includes('high-bp') || medicalFlags.includes('elevated-bp')) {
    if ((item.tags || []).includes('low-sodium')) {
      reasons.push("blood pressure management → low sodium recommended");
    }
  }
  if (medicalFlags.includes('high-activity')) {
    if ((item.tags || []).includes('high-protein') || (item.tags || []).includes('high-protein-snack')) {
      reasons.push("high activity recovery → protein-rich meal");
    }
  }
  if (medicalFlags.includes('low-activity')) {
    if ((item.tags || []).includes('light-clean') || (item.tags || []).includes('low-calorie')) {
      reasons.push("low activity → light, nutrient-dense option");
    }
  }

  const matchedTags = (item.tags || []).filter(t => profileTags.includes(t));
  if (matchedTags.length > 0 && reasons.length === 0) {
    const tagNames = matchedTags.slice(0, 2).join(', ');
    reasons.push(`recommended diet pattern: ${tagNames}`);
  }

  if((w.caloriesBurned||0) > 400 && (item.tags || []).includes('high-protein-snack')) reasons.push("high calorie burn → protein supports recovery");
  if(((w.bpSystolic||0) >= 130 || (w.bpDiastolic||0) >= 80) && (item.tags || []).includes('low-sodium')) reasons.push("elevated BP → low sodium helps");
  if(((w.analysis?.activityLevel||'').toLowerCase()) === 'low' && (item.tags || []).includes('light-clean')) reasons.push("low activity → lighter, easy-to-digest meal");

  const tagExplain = {
    'satvik':'simple, plant-based, easy to digest',
    'low-carb':'lower carbs to avoid spikes',
    'high-protein':'higher protein to support muscle',
    'high-protein-snack':'higher protein to support muscle',
    'low-sodium':'reduced sodium for BP control',
    'light-clean':'minimal oil, clean prep',
    'balanced':'well-rounded nutrition',
    'anti-inflammatory':'anti-inflammatory benefits'
  };
  const fallback = (item.tags||[]).map(t => tagExplain[t]).filter(Boolean)[0] || 'matches your preferences';
  let why = reasons.length ? reasons.join(' • ') : fallback;

  const w2 = state.wearable || {};
  const hasVitals = (w2 && (w2.caloriesBurned != null || (w2.bpSystolic != null && w2.bpDiastolic != null) || (w2.analysis && w2.analysis.activityLevel)));
  if (hasVitals) {
    const parts = [];
    if (w2.caloriesBurned != null) parts.push('calorie burn');
    if (w2.bpSystolic != null && w2.bpDiastolic != null) parts.push('blood pressure');
    if (w2.analysis && w2.analysis.activityLevel) parts.push('activity');
    const metricsList = parts.join(', ');
    why = `${why} based on your wearable metrics (${metricsList})`;
  } else {
    why = `${why} based on your wearable metrics`;
  }

  return `<div class="whyline"><b>${persona}:</b> ${escapeHtml(why)}.</div>`;
}

function toggleWhy(item){
  const id = slug(item.title);
  const box = byId(`whybox-${id}`);
  if (!box) return;

  // Toggle: if already visible, hide it
  if (!box.hidden) {
    box.hidden = true;
    state.openWhyBoxes.delete(item.title);
    return;
  }

  // Show the box
  box.hidden = false;
  state.openWhyBoxes.add(item.title);

  // Check if content is already loaded with new format (version 2)
  if (item.__reasonHtml && item.__reasonVersion === 2) {
    box.innerHTML = item.__reasonHtml;
    return;
  }

  // Clear old cached data to regenerate with new format
  item.__reasonHtml = null;
  item.__evidencePapers = null;
  item.__reasonVersion = 2;

  // Load content - no "Our Analysis" section, just show loading
  box.innerHTML = '<div class="loading">⏳ Fetching evidences and studies we used...</div>';

  ensureMacros(item).then(async () => {
    const tags = item.tags || [];
    const w = state.wearable || {};
    const macros = item.macros || {};
    
    // Smart evidence fetching - determine how many studies needed
    const evidencePapers = [];
    if (!item.__evidencePapers || !item.__evidencePapers.length) {
      // Build a list of relevant search areas based on tags, health metrics, and macros
      const searchAreas = [];
      
      // Add tag-based searches
      tags.slice(0, 2).forEach(tag => searchAreas.push({ type: 'tag', value: tag }));
      
      // Add health-metric based searches
      if (w.bpSystolic && w.bpSystolic >= 130) {
        searchAreas.push({ type: 'tag', value: 'low-sodium' });
      }
      if (w.caloriesBurned && w.caloriesBurned > 400) {
        searchAreas.push({ type: 'tag', value: 'high-protein-snack' });
      }
      
      // Add macro-based searches
      if (macros.protein_g && macros.protein_g > 15) {
        searchAreas.push({ type: 'tag', value: 'high-protein-snack' });
      }
      if (macros.fiber_g && macros.fiber_g > 5) {
        searchAreas.push({ type: 'custom', value: 'high fiber diet health benefits' });
      }
      
      // Deduplicate and limit to 3-4 studies
      const uniqueSearches = [...new Set(searchAreas.map(s => s.value))].slice(0, 4);
      
      // Fetch evidence in parallel
      const evidencePromises = uniqueSearches.map(search => {
        // Check if it's a known tag or custom search
        const knownTags = Object.keys(EVIDENCE_QUERIES);
        if (knownTags.includes(search)) {
          return fetchEvidenceForTag(search);
        } else {
          // For custom searches, fetch directly
          return fetchCustomEvidence(search);
        }
      });
      
      const results = await Promise.all(evidencePromises);
      
      // Filter out nulls and duplicates
      const seen = new Set();
      results.forEach(ev => {
        if (ev && ev.url && !seen.has(ev.url)) {
          seen.add(ev.url);
          evidencePapers.push(ev);
        }
      });
      
      // Ensure at least 1 study
      if (evidencePapers.length === 0 && tags[0]) {
        const fallback = await fetchEvidenceForTag(tags[0]);
        if (fallback) evidencePapers.push(fallback);
      }
      
      item.__evidencePapers = evidencePapers;
    } else {
      evidencePapers.push(...item.__evidencePapers);
    }
    
    // Display evidence papers (replace loading message)
    if (evidencePapers.length > 0) {
      let evidenceHtml = '<div style="margin-bottom: 8px;">';
      evidencePapers.forEach((ev, idx) => {
        if (idx > 0) evidenceHtml += '<br>';
        
        // Add evidence strength indicator
        const strengthLabels = {
          'strong': '●●●',
          'moderate': '●●○',
          'basic': '●○○'
        };
        const strengthColors = {
          'strong': '#10b981',
          'moderate': '#f59e0b',
          'basic': '#6b7280'
        };
        const strength = ev.evidenceStrength || 'basic';
        const strengthIcon = strengthLabels[strength] || '●○○';
        const strengthColor = strengthColors[strength] || '#6b7280';
        
        evidenceHtml += `<span class="muted small">
          <span style="color: ${strengthColor}; font-size: 10px;" title="${strength} evidence">${strengthIcon}</span>
          <a href="${escapeHtml(ev.url)}" target="_blank" rel="noopener">Study ${idx + 1}: ${escapeHtml(ev.title?.slice(0, 50) || 'Research')}${(ev.title?.length || 0) > 50 ? '...' : ''}</a>
        </span>`;
      });
      evidenceHtml += '</div>';
      // Remove loading message and set evidence
      const loading = box.querySelector('.loading');
      if (loading) loading.remove();
      box.innerHTML = evidenceHtml;
    }
    
    // Get the primary evidence for AI reasoning
    const primaryEvidence = evidencePapers[0] || null;
    const evidenceAbstract = primaryEvidence?.abstract || '';
    const evidenceTitle = primaryEvidence?.title || 'health research';
    
    const systemMsg = {
      role: 'system',
      content: `You are a clinical nutritionist. Create a simple, easy-to-understand explanation.
Format EXACTLY as: "According to study (research) '${evidenceTitle}', this dish ${item.title} best suits your health data (today's burn [calories] kcal, BP [systolic]/[diastolic])."
- Keep it simple and comprehensive for everyone, not just health enthusiasts
- Use the exact format above
- Include the user's specific health numbers
- Keep under 100 words
- No complex medical terms`
    };
    const userMsg = {
      role: 'user',
      content: `User metrics: caloriesBurned=${w.caloriesBurned ?? 'NA'} kcal, BP=${w.bpSystolic ?? 'NA'}/${w.bpDiastolic ?? 'NA'}, steps=${w.steps ?? 'NA'}, heartRate=${w.heartRate ?? 'NA'}.
Dish: ${item.title}
Dish tags: ${(item.tags || []).join(', ')}.
Dish nutrition per 100g: ${macros.kcal ?? 'NA'} kcal, ${macros.protein_g ?? 'NA'}g protein, ${macros.carbs_g ?? 'NA'}g carbs, ${macros.fat_g ?? 'NA'}g fat.
Evidence summary: ${evidenceAbstract.slice(0, 600)}`
    };
    
    let answer = '';
    try{
      const resp = await fetch('/api/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [systemMsg, userMsg], temperature: 0.2,
          context: { evidenceTitle, evidenceAbstract, vitals: w, macros, dish: { title: item.title, tags: item.tags } }
        })
      });
      if(resp.ok){
        const data = await resp.json();
        answer = (data && data.answer && data.answer.trim() && data.answer !== '(no answer)') ? String(data.answer).trim() : '';
      }
    } catch(_e) {}

    // Fallback answer with simple format
    if(!answer){
      const calories = w.caloriesBurned || 'NA';
      const bp = `${w.bpSystolic || 'NA'}/${w.bpDiastolic || 'NA'}`;
      answer = `According to study (research) '${evidenceTitle}', this dish ${item.title} best suits your health data (today's burn ${calories} kcal, BP ${bp}).`;
    }
    
    const htmlReason = escapeHtml(answer).replace(/\n/g, '<br>');
    box.innerHTML += `<br><span class="muted small">AI reason: ${htmlReason}</span>`;
    
    // Add health alignment reasons if available
    if (item.__healthAlignment) {
      const align = item.__healthAlignment;
      if (align.boostReasons.length > 0 || align.riskFlags.length > 0) {
        let alignHtml = '<br><div style="margin-top: 8px; padding: 8px; background: #f3f4f6; border-radius: 6px; font-size: 13px;">';
        
        if (align.boostReasons.length > 0) {
          alignHtml += '<div style="color: #10b981; margin-bottom: 4px;"><b>✓ Good match:</b></div>';
          align.boostReasons.forEach(reason => {
            alignHtml += `<div style="margin-left: 12px; color: #374151;">• ${escapeHtml(reason)}</div>`;
          });
        }
        
        if (align.riskFlags.length > 0) {
          if (align.boostReasons.length > 0) alignHtml += '<div style="margin-top: 6px;"></div>';
          alignHtml += '<div style="color: #ef4444; margin-bottom: 4px;"><b>⚠ Consider:</b></div>';
          align.riskFlags.forEach(flag => {
            alignHtml += `<div style="margin-left: 12px; color: #374151;">• ${escapeHtml(flag)}</div>`;
          });
        }
        
        alignHtml += '</div>';
        box.innerHTML += alignHtml;
      }
    }
    
    item.__reasonHtml = box.innerHTML;
    item.__reasonVersion = 2; // Mark as new format
  }).catch(() => {
    const w = state.wearable || {};
    const calories = w.caloriesBurned || 'NA';
    const bp = `${w.bpSystolic || 'NA'}/${w.bpDiastolic || 'NA'}`;
    const generic = `According to health research, this dish ${item.title} suits your health data (today's burn ${calories} kcal, BP ${bp}).`;
    box.innerHTML += `<br><span class="muted small">AI reason: ${escapeHtml(generic)}</span>`;
    item.__reasonHtml = box.innerHTML;
    item.__reasonVersion = 2; // Mark as new format
  });
}

// ---------- evidence lookup ----------
const EVIDENCE_QUERIES = {
  'low-sodium': [
    'low sodium diet blood pressure clinical trial',
    'salt intake hypertension study',
    'reduced salt cardiovascular health',
    'sodium reduction and heart disease',
    'low salt diet and stroke prevention'
  ],
  'high-protein-snack': [
    'protein intake muscle recovery study',
    'high protein snack benefits',
    'protein snack exercise recovery',
    'post-workout protein snack research',
    'protein consumption and muscle synthesis'
  ],
  'light-clean': [
    'light meal digestion benefits',
    'small meal digestion study',
    'light dinner health benefits',
    'low-fat meal digestive efficiency',
    'healthy light meals research'
  ],
  'satvik': [
    'sattvic diet health benefits',
    'sattvic food benefits',
    'ayurvedic sattvic diet',
    'satvik lifestyle research',
    'sattvic diet scientific evidence'
  ],
  'low-carb': [
    'low carbohydrate diet blood sugar control',
    'low carb diet study weight loss',
    'reduced carbohydrate health benefits',
    'ketogenic diet clinical trial',
    'low carb diet and cholesterol'
  ]
};

const STATIC_EVIDENCE = {
  'low-sodium': { title:'Reducing sodium intake lowers blood pressure', url:'https://www.nih.gov/news-events/news-releases/low-sodium-diet-benefits-blood-pressure' },
  'high-protein-snack': { title:'Why protein matters after exercise', url:'https://www.bhf.org.uk/informationsupport/heart-matters-magazine/nutrition/ask-the-expert/why-is-protein-important-after-exercise' },
  'light-clean': { title:'Heavy meals can make you feel sluggish', url:'https://health.clevelandclinic.org/should-you-eat-heavy-meals-before-bed' },
  'low-carb': { title:'Eating protein/veg before carbs helps control blood glucose', url:'https://www.uclahealth.org/news/eating-certain-order-helps-control-blood-glucose' },
  'satvik': { title:'What Is the Sattvic Diet? Review, Food Lists, and Menu', url:'https://www.healthline.com/nutrition/sattvic-diet-review' }
};

async function fetchEvidenceForTag(tag){
  if(!tag) return null;
  let query;
  const list = EVIDENCE_QUERIES[tag];
  if (Array.isArray(list) && list.length > 0) {
    const idx = Math.floor(Math.random() * list.length);
    query = list[idx];
  } else {
    query = `${tag} diet health benefits`;
  }
  try{
    const r = await fetch(`/api/evidence?q=${encodeURIComponent(query)}`);
    if(!r.ok) throw new Error('evidence fetch failed');
    const j = await r.json();
    if(j && j.title){
      return j;
    }
  } catch(_e){}
  if(STATIC_EVIDENCE[tag]){
    return STATIC_EVIDENCE[tag];
  }
  return null;
}

async function fetchCustomEvidence(query){
  if(!query) return null;
  try{
    const r = await fetch(`/api/evidence?q=${encodeURIComponent(query)}`);
    if(!r.ok) throw new Error('evidence fetch failed');
    const j = await r.json();
    if(j && j.title){
      return j;
    }
  } catch(_e){}
  return null;
}

// ---------- macros via Multi-tier Nutrition Lookup ----------
async function ensureMacros(item){
  if(item.macros) return;
  const cached = state.macrosCache[item.title];
  if(cached && Date.now() - (cached.ts || 0) < 7 * 24 * 60 * 60 * 1000){
    item.macros = cached.macros; 
    item.macrosSource = cached.source;
    item.micros = cached.micros;
    item.nutritionTier = cached.tier;
    
    // Add confidence label
    if (typeof window.Personalization !== 'undefined') {
      item.macrosConfidence = window.Personalization.getMacroConfidence(
        cached.tier, 
        cached.source
      );
    }
    return;
  }
  try{
    const r = await fetch(`/api/nutrition-lookup?q=${encodeURIComponent(item.title)}`);
    if(r.ok){
      const j = await r.json();
      if(j.found && j.macros){
        item.macros = j.macros;
        item.macrosSource = j.source;
        item.micros = j.micros || {};
        item.nutritionTier = j.tier || 0;
        
        // Add confidence label
        if (typeof window.Personalization !== 'undefined') {
          item.macrosConfidence = window.Personalization.getMacroConfidence(
            j.tier, 
            j.source
          );
        }
        
        state.macrosCache[item.title] = { 
          ts: Date.now(), 
          macros: item.macros, 
          micros: item.micros,
          source: item.macrosSource,
          tier: item.nutritionTier
        };
        saveCache('macrosCache', state.macrosCache);
      }
    }
  } catch(_e){
    console.warn('Nutrition lookup failed for', item.title);
  }
}

// ---------- feedback / learning ----------
function feedback(item, delta){
  (item.tags || []).forEach(t => {
    state.model[t] = (state.model[t] || 0) + delta * 2;
    state.model[t] = clamp(state.model[t], -20, 40);
    if(!state.tagStats[t]) state.tagStats[t] = { shown: 0, success: 0 };
    if(delta > 0) state.tagStats[t].success += 1;
  });
  saveModel(state.model);
  saveCache('tagStats', state.tagStats);
  recompute();
}

// ---------- model store ----------
function loadModel(){ try{ return JSON.parse(localStorage.getItem('userModel') || '{}'); } catch(_){ return {}; } }
function saveModel(m){ localStorage.setItem('userModel', JSON.stringify(m)); }

// ---------- ordering functionality ----------
/**
 * Get or generate a user ID for ordering
 * Uses localStorage to persist user ID across sessions
 */
function getUserId() {
  let userId = localStorage.getItem('userId');
  if (!userId) {
    // Generate a simple user ID (timestamp + random)
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', userId);
  }
  return userId;
}

/**
 * Open the order modal/form for a dish
 * @param {Object} item - The dish item to order
 */
function openOrderModal(item) {
  // Remove any existing modal
  const existing = document.getElementById('orderModal');
  if (existing) existing.remove();
  
  // Create modal HTML
  const modalHtml = `
    <div id="orderModal" class="modal-overlay" style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    ">
      <div class="modal-content" style="
        background: var(--panel);
        border: 1px solid var(--ring);
        border-radius: 18px;
        padding: 24px;
        max-width: 400px;
        width: 100%;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      ">
        <h3 style="margin-top: 0; margin-bottom: 16px;">Place Order</h3>
        
        <div style="background: rgba(79, 195, 255, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(item.title)}</div>
          <div style="color: var(--muted); font-size: 13px;">
            ${item.vendorName ? escapeHtml(item.vendorName) : 'Partner restaurant'}
            ${item.price ? ` • ₹${item.price}` : ''}
          </div>
        </div>
        
        <form id="orderForm">
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">Quantity</label>
            <select id="orderQuantity" style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid var(--ring);
              background: var(--bg);
              color: var(--text);
              border-radius: 8px;
              font-size: 14px;
            ">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
          
          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">Delivery Address</label>
            <textarea id="orderAddress" rows="3" placeholder="Enter your delivery address" style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid var(--ring);
              background: var(--bg);
              color: var(--text);
              border-radius: 8px;
              font-size: 14px;
              font-family: inherit;
              resize: vertical;
            " required></textarea>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">Phone Number</label>
            <input type="tel" id="orderPhone" placeholder="10-digit mobile number" pattern="[0-9]{10}" style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid var(--ring);
              background: var(--bg);
              color: var(--text);
              border-radius: 8px;
              font-size: 14px;
            " required/>
          </div>
          
          <div style="display: flex; gap: 8px; margin-top: 20px;">
            <button type="button" id="cancelOrder" class="pill ghost" style="flex: 1;">Cancel</button>
            <button type="submit" class="pill" style="flex: 1;">Confirm Order</button>
          </div>
        </form>
        
        <div id="orderStatus" style="margin-top: 12px; display: none;"></div>
      </div>
    </div>
  `;
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Get modal elements
  const modal = document.getElementById('orderModal');
  const form = document.getElementById('orderForm');
  const cancelBtn = document.getElementById('cancelOrder');
  const statusDiv = document.getElementById('orderStatus');
  
  // Pre-fill from localStorage if available
  const savedAddress = localStorage.getItem('orderAddress');
  const savedPhone = localStorage.getItem('orderPhone');
  if (savedAddress) document.getElementById('orderAddress').value = savedAddress;
  if (savedPhone) document.getElementById('orderPhone').value = savedPhone;
  
  // Cancel button handler
  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });
  
  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Form submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const quantity = parseInt(document.getElementById('orderQuantity').value);
    const address = document.getElementById('orderAddress').value.trim();
    const phone = document.getElementById('orderPhone').value.trim();
    
    // Save for next time
    localStorage.setItem('orderAddress', address);
    localStorage.setItem('orderPhone', phone);
    
    // Disable form
    form.querySelectorAll('input, textarea, select, button').forEach(el => el.disabled = true);
    
    // Show loading status
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '<div style="text-align: center; color: var(--accent);">⏳ Placing your order...</div>';
    
    try {
      // Create order
      const orderData = {
        user_id: getUserId(),
        vendor_id: item.vendorId || 'unknown',
        vendor_name: item.vendorName || 'Partner restaurant',
        dish_id: item.id || slug(item.title),
        dish_title: item.title,
        quantity: quantity,
        price: item.price || 0,
        address: address,
        phone: phone
      };
      
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      
      // Parse response body for both success and error cases
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error('Failed to communicate with server');
      }
      
      if (!response.ok) {
        // Show specific error message from server if available
        const errorMsg = result?.error || result?.message || 'Failed to place order';
        console.error('Order placement failed:', errorMsg);
        throw new Error(errorMsg);
      }
      
      // Verify order was created successfully
      if (!result.success || !result.order_id) {
        console.error('Order response missing success or order_id:', result);
        throw new Error('Order creation did not complete successfully');
      }
      
      // Show success
      statusDiv.innerHTML = `
        <div style="text-align: center; color: #10b981; padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px;">
          ✓ Order placed successfully!
          <div style="margin-top: 8px; font-size: 13px;">
            Order ID: ${result.order_id}
          </div>
          <div style="margin-top: 12px;">
            <a href="orders.html" class="pill" style="display: inline-block; text-decoration: none;">View My Orders</a>
          </div>
        </div>
      `;
      
      // Close modal after 3 seconds
      setTimeout(() => {
        modal.remove();
      }, 3000);
      
    } catch (error) {
      console.error('Order error:', error);
      
      // Show error with more specific message
      const errorMessage = error.message || 'Ordering is temporarily unavailable';
      statusDiv.innerHTML = `
        <div style="text-align: center; color: #ef4444; padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">
          ⚠️ ${errorMessage}
          <div style="margin-top: 8px; font-size: 13px;">
            Please try again later or contact support if the problem persists.
          </div>
        </div>
      `;
      
      // Re-enable form
      form.querySelectorAll('input, textarea, select, button').forEach(el => el.disabled = false);
    }
  });
}

})();
