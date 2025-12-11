const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
// fixed import for csv-parse sync API
const { parse } = require('csv-parse/sync')

// Simple helper to parse CSV in repo/data/
function loadCsv(name) {
  const p = path.join(__dirname, '..', 'data', name)
  if (!fs.existsSync(p)) return []
  return parse(fs.readFileSync(p,'utf8'), { columns: true, skip_empty_lines: true })
}

async function seedCsvTable(client, table, columns, rows) {
  if (!rows.length) return 0
  for (const r of rows) {
    const vals = columns.map(c => {
      if (!(c in r)) return null
      const v = r[c]
      if (v === '') return null
      if ((typeof v === 'string') && ((v.startsWith('{') && v.endsWith('}')) || (v.startsWith('[') && v.endsWith(']')))) {
        try { return JSON.parse(v) } catch (e) { return v }
      }
      return v
    })
    const placeholders = columns.map((_, i) => `$${i+1}`).join(',')
    const q = `INSERT INTO ${table}(${columns.join(',')}) VALUES(${placeholders}) ON CONFLICT DO NOTHING`
    await client.query(q, vals)
  }
  return rows.length
}

async function importVendorMenus(client) {
  const file = path.join(__dirname,'..','vendor_menus.json')
  if (!fs.existsSync(file)) return { createdVendors:0, upsertedMenus:0 }
  const data = JSON.parse(fs.readFileSync(file,'utf8'))
  let createdVendors = 0, upsertedMenus = 0
  for (const v of data.vendors || []) {
    let vendorId = null
    const resExt = await client.query('SELECT id FROM vendors WHERE external_id = $1 LIMIT 1', [v.id])
    if (resExt.rows.length) vendorId = resExt.rows[0].id
    else {
      const resName = await client.query('SELECT id FROM vendors WHERE LOWER(name) = LOWER($1) LIMIT 1', [v.name])
      if (resName.rows.length) {
        vendorId = resName.rows[0].id
        await client.query('UPDATE vendors SET external_id = COALESCE(external_id, $2) WHERE id = $1', [vendorId, v.id])
      }
    }
    if (!vendorId) {
      const r = await client.query('INSERT INTO vendors (name, external_id, created_at) VALUES ($1,$2,NOW()) RETURNING id', [v.name, v.id])
      vendorId = r.rows[0].id
      createdVendors++
    }
    for (const dish of v.dishes || []) {
      const upsertQ = `
        INSERT INTO vendor_menu
          (vendor_id, dish_id, name, description, price, category, health_tags, nutrition_info, image_url, is_available, preparation_time)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (vendor_id, dish_id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          category = EXCLUDED.category,
          health_tags = EXCLUDED.health_tags,
          nutrition_info = EXCLUDED.nutrition_info,
          image_url = EXCLUDED.image_url,
          is_available = EXCLUDED.is_available,
          preparation_time = EXCLUDED.preparation_time
      `
      const dishId = dish.id || null
      const name = dish.title || dish.name || ''
      const description = dish.hero || dish.description || null
      const price = (dish.price !== undefined) ? dish.price : null
      const category = dish.type || null
      const healthTags = Array.isArray(dish.tags) ? dish.tags : null
      const nutritionInfo = dish.nutrition_info || null
      const imageUrl = dish.image || null
      const isAvailable = (typeof dish.isOpen === 'boolean') ? dish.isOpen : true
      const preparation_time = dish.preparation_time || null

      await client.query(upsertQ, [
        vendorId,
        dishId,
        name,
        description,
        price,
        category,
        healthTags,
        nutritionInfo,
        imageUrl,
        isAvailable,
        preparation_time
      ])
      upsertedMenus++
    }
  }
  return { createdVendors, upsertedMenus }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Set DATABASE_URL and put CSVs in data/ if you use them.')
    process.exit(1)
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    // Seed CSVs if present (adjust columns as-needed)
    const usersRows = loadCsv('sample_users.csv')
    await seedCsvTable(client, 'users', ['id','user_id','name','email','phone','address','preferences','created_at','last_login','gender','date_of_birth','country','city','timezone','device_sync_status','last_synced_device','real_time_metrics','user_wellness_score'], usersRows)

    const uwRows = loadCsv('sample_user_wearable_stream.csv')
    await seedCsvTable(client, 'user_wearable_stream', ['id','user_id','source','metric_type','value','unit','recorded_at','received_at','raw_payload'], uwRows)

    const dhRows = loadCsv('sample_user_daily_health_summary.csv')
    await seedCsvTable(client, 'user_daily_health_summary', ['id','user_id','date','steps','calories_burned','avg_heart_rate','max_heart_rate','sleep_hours','stress_score','readiness_score'], dhRows)

    const vendorsRows = loadCsv('sample_vendors.csv')
    await seedCsvTable(client, 'vendors', ['id','name','preparation_time_avg','order_fulfillment_rate','hygiene_score','inventory_status','peak_hour_stats','vendor_revenue_history'], vendorsRows)

    const vmRows = loadCsv('sample_vendor_menu.csv')
    await seedCsvTable(client, 'vendor_menu', ['id','vendor_id','dish_id','name','description','price','category','health_tags','nutrition_info','image_url','is_available','preparation_time'], vmRows)

    const ordersRows = loadCsv('sample_orders.csv')
    await seedCsvTable(client, 'orders', ['id','user_phone','user_name','vendor_id','dish_name','quantity','amount','status','allocation_status','assigned_rider_id','current_candidate_rider_id','candidate_riders','address','created_at','updated_at','vendor_name','user_id','dish_id'], ordersRows)

    const ridersRows = loadCsv('sample_riders.csv')
    await seedCsvTable(client, 'riders', ['id','name','zone','phone','created_at','is_active','is_online','last_online_at','last_location_update','kyc_status','documents','current_location','earnings_total','total_deliveries','rating'], ridersRows)

    // Import vendor menus (JSON)
    const res = await importVendorMenus(client)
    console.log('Vendor import result:', res)

    console.log('Seeding finished. Verify in Supabase.')
  } catch (err) {
    console.error('Seed error:', err.message || err)
  } finally {
    await client.end()
  }
}

main()