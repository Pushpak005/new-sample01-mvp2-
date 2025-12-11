/**
 * Usage:
 *   1) npm init -y
 *   2) npm install @supabase/supabase-js
 *   3) export SUPABASE_URL="https://<your>.supabase.co"
 *      export SUPABASE_KEY="<your_service_role_key>"
 *   4) node import_vendors_to_supabase.js [path-to-local-json]
 *
 * If you omit the file path the script will fetch:
 * https://raw.githubusercontent.com/Pushpak005/ACL25MVPv2/main/vendor_menus.json
 *
 * IMPORTANT: Use a service_role key for upserts (server-side). Do NOT expose this key in client code.
 */
const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Set SUPABASE_URL and SUPABASE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function loadJson(fileArg) {
  if (fileArg) {
    const p = path.resolve(fileArg);
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw);
  } else {
    const rawUrl = 'https://raw.githubusercontent.com/Pushpak005/ACL25MVPv2/main/vendor_menus.json';
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error('Failed to fetch JSON from GitHub: ' + res.statusText);
    return await res.json();
  }
}

function normalizeTags(tags) {
  if (!tags) return null;
  return tags.map(t => String(t).trim());
}

function parsePrice(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/[^\d.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function upsertVendor(v) {
  const vendorPayload = {
    id: v.id,
    name: v.name || null,
    city: v.city || null,
    area: v.area || null,
    is_open: v.isOpen === undefined ? null : !!v.isOpen,
    metadata: v
  };
  const { error } = await supabase.from('vendors').upsert(vendorPayload, { onConflict: 'id' });
  if (error) throw error;
}

async function upsertDish(d, vendorId) {
  const tags = Array.isArray(d.tags) ? normalizeTags(d.tags) : null;
  const price = parsePrice(d.price);
  const dishPayload = {
    id: d.id,
    vendor_id: vendorId,
    title: d.title || null,
    hero: d.hero || null,
    type: d.type || null,
    tags: tags,
    raw_tags: d.tags ? d.tags : null,
    price: price,
    metadata: d
  };
  const { error } = await supabase.from('dishes').upsert(dishPayload, { onConflict: 'id' });
  if (error) throw error;
}

async function main() {
  try {
    const arg = process.argv[2];
    const json = await loadJson(arg);
    const vendors = json.vendors || [];
    console.log(`Found ${vendors.length} vendors in JSON.`);

    for (const v of vendors) {
      process.stdout.write(`Upserting vendor ${v.id} ... `);
      await upsertVendor(v);
      console.log('ok');

      if (Array.isArray(v.dishes)) {
        for (const d of v.dishes) {
          if (!d.id) {
            console.warn(`Skipping dish with no id for vendor ${v.id}`);
            continue;
          }
          process.stdout.write(`  Upserting dish ${d.id} ... `);
          try {
            await upsertDish(d, v.id);
            console.log('ok');
          } catch (e) {
            console.error('error', e.message || e);
          }
        }
      }
    }

    console.log('Import complete.');
  } catch (err) {
    console.error('Fatal error:', err.message || err);
    process.exit(1);
  }
}

main();