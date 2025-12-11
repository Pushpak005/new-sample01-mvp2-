/**
 * Safe import for vendor_menus.json
 *
 * Usage:
 *   1) Put this file at scripts/importVendorMenus.js in repo.
 *   2) Ensure vendor_menus.json is at repo root.
 *   3) Set DATABASE_URL env var.
 *   4) Run: node scripts/importVendorMenus.js
 *
 * It will:
 *  - Find vendor by vendors.external_id or vendors.name
 *  - Create vendor if missing (keeps DB-generated id)
 *  - Upsert each dish into vendor_menu using (vendor_id, dish_id)
 */
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const FILE = path.join(__dirname, '..', 'vendor_menus.json')
if (!fs.existsSync(FILE)) {
  console.error('Error: vendor_menus.json not found at', FILE)
  process.exit(1)
}
const RAW = fs.readFileSync(FILE, 'utf8')
const DATA = JSON.parse(RAW)

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Set DATABASE_URL environment variable first')
    process.exit(1)
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })
  await client.connect()

  let createdVendors = 0
  let upsertedMenus = 0
  try {
    for (const v of DATA.vendors || []) {
      let vendorId = null

      // 1) try match by external_id
      const resExt = await client.query('SELECT id FROM vendors WHERE external_id = $1 LIMIT 1', [v.id])
      if (resExt.rows.length) vendorId = resExt.rows[0].id
      else {
        // 2) try match by name (case-insensitive)
        const resName = await client.query('SELECT id FROM vendors WHERE LOWER(name) = LOWER($1) LIMIT 1', [v.name])
        if (resName.rows.length) {
          vendorId = resName.rows[0].id
          // set external_id for future use
          await client.query('UPDATE vendors SET external_id = COALESCE(external_id, $2) WHERE id = $1', [vendorId, v.id])
        }
      }

      // 3) create vendor if still not found
      if (!vendorId) {
        const r = await client.query(
          'INSERT INTO vendors (name, external_id, created_at) VALUES ($1,$2,NOW()) RETURNING id',
          [v.name, v.id]
        )
        vendorId = r.rows[0].id
        createdVendors++
      }

      // 4) upsert menu items
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

    console.log(`Done. Vendors created: ${createdVendors}. Menu items upserted: ${upsertedMenus}.`)
  } catch (err) {
    console.error('Import error:', err.message || err)
  } finally {
    await client.end()
  }
}

main()