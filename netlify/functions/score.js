/*
Netlify Function: /.netlify/functions/score
- If SCORING_SERVICE_URL env var is set, forward the request there.
- Else run a server-side heuristic to compute score + reasons.
*/
exports.handler = async function(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const vitals = body.vitals || {};
    const item = body.item || {};
    const llmIn = body.llmScore;

    // If a remote scoring service is configured, proxy to it
    const scoringUrl = process.env.SCORING_SERVICE_URL;
    const scoringKey = process.env.SCORING_SERVICE_KEY;
    if (scoringUrl) {
      const fetchResp = await fetch(scoringUrl.replace(/\/$/, '') + '/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(scoringKey ? { 'Authorization': `Bearer ${scoringKey}` } : {})
        },
        body: JSON.stringify(body),
      });
      const forwarded = await fetchResp.json().catch(() => null);
      return { statusCode: fetchResp.status || 200, body: JSON.stringify(forwarded || {}) };
    }

    // Fallback: local heuristic scoring (explainable)
    const tags = (item.tags || []).map(t => String(t).toLowerCase());
    const macros = item.macros || {};
    const reasons = [];
    let score = 0.0;

    const bpS = Number(vitals.bpSystolic || 0);
    const bpD = Number(vitals.bpDiastolic || 0);
    if (bpS >= 130 || bpD >= 80) {
      if (tags.includes('low-sodium')) { score += 12; reasons.push('low-sodium fits elevated BP'); }
      if (tags.includes('high-sodium')) { score -= 8; reasons.push('high-sodium not ideal for BP'); }
    }

    const caloriesBurned = Number(vitals.calories_burned_today || vitals.caloriesBurned || 0);
    if (caloriesBurned > 400) {
      if (tags.includes('high-protein') || tags.includes('high-protein-snack') || (Number(macros.protein_g || macros.protein || 0) >= 12)) {
        score += 10; reasons.push('supports recovery after high activity');
      } else {
        score += 1; reasons.push('activity suggests slightly higher needs');
      }
    }

    const activity = ((vitals.analysis || {}).activityLevel || '').toLowerCase();
    if (activity === 'low') {
      if (tags.includes('light-clean') || tags.includes('low-calorie')) { score += 8; reasons.push('light meal suits low activity'); }
      else { score -= 3; reasons.push('may be heavy for low activity'); }
    }

    const prot = Number(macros.protein_g || macros.protein || 0);
    if (prot >= 15) { score += 4; reasons.push('high protein content'); }
    const kcal = Number(macros.kcal || macros.calories || 0);
    if (kcal && kcal <= 200) { score += 3; reasons.push('low calorie per serving'); }

    // small stable bandit mock (no persistence here)
    (tags || []).forEach(t => { score += 0.8; });

    if (typeof llmIn === 'number') {
      score += llmIn * 2;
      reasons.push('llm score applied');
    }

    if (score < -20) score = -20;
    if (score > 100) score = 100;

    return { statusCode: 200, body: JSON.stringify({ score: Number(score.toFixed(2)), reasons, llmScore: llmIn || 0 }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
