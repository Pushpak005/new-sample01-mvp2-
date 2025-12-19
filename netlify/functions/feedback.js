/*
Netlify Function: /.netlify/functions/feedback
Writes user feedback into Supabase REST API table 'feedback'.
REQUIRES environment variables:
  SUPABASE_URL=https://vemjldavwzwbkvpsiccq.supabase.co
  SUPABASE_KEY=sb_secret_FgNR2jEP1QwZIW-P9TWsGg_jMh4bFb8

This implementation validates envs, uses fetch, and returns JSON.
*/
exports.handler = async function(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const user_id = body.user_id || body.userId || null;
    const vendor = body.vendor || null;
    const item_title = body.item_title || body.itemTitle || null;
    const action = body.action || null; // e.g. "like" or "skip"
    if (!item_title || !action) {
      return { statusCode: 400, body: JSON.stringify({ error: "missing item_title or action" }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "SUPABASE_URL or SUPABASE_KEY not configured" }) };
    }

    const row = { user_id, vendor, item_title, action, ts: new Date().toISOString() };

    // Use Supabase REST insert into 'feedback' table
    const resp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(row)
    });

    const text = await resp.text();

    if (!resp.ok) {
      // Try to return JSON if possible
      let parsed = text;
      try { parsed = JSON.parse(text); } catch (_) {}
      return { statusCode: 500, body: JSON.stringify({ error: 'supabase insert failed', status: resp.status, body: parsed }) };
    }

    // Return the inserted row(s) from Supabase (if return=representation)
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { parsed = text; }

    return { statusCode: 200, body: JSON.stringify({ ok: true, saved: true, result: parsed }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
