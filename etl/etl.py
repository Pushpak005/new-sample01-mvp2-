#!/usr/bin/env python3
"""
ETL for the Healthy Diet demo.

Reads:
  - data/vendor_menus.json       (optional; vendor objects with "items" lists)
  - data/partner_menus.json      (optional; flat list of items with "hotel"/"name"/"price")
  - data/wearable_stream.json    (unused here but kept for compatibility)

Produces:
  - data/aggregates.csv  (vendor-level aggregates)
  - data/output.db       (SQLite table 'vendor_aggregates')
"""
import sys
import json
import csv
from pathlib import Path
import sqlite3
from collections import defaultdict

def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))

def normalize_partner_items(partner_items):
    """
    Convert a flat list of partner items (each item has 'hotel' and 'name' etc)
    into vendor objects of the form {'vendorName': <hotel>, 'items': [ {...}, ... ]}.
    """
    grouped = defaultdict(list)
    for it in partner_items:
        hotel = it.get('hotel') or it.get('vendor') or it.get('hotelName') or 'UNKNOWN'
        # map common field names to the item shape used by the rest of the ETL
        item = {}
        item['id'] = it.get('id') or it.get('item_id') or it.get('sku') or None
        item['title'] = it.get('title') or it.get('name') or it.get('dish') or None
        # ensure numeric price when possible
        price = it.get('price')
        try:
            if price is None or price == "":
                item['price'] = 0
            else:
                item['price'] = int(price)
        except Exception:
            try:
                item['price'] = int(float(price))
            except Exception:
                item['price'] = 0
        # nutrition may be present under different shapes; keep if exists
        if 'nutrition' in it and isinstance(it['nutrition'], dict):
            item['nutrition'] = it['nutrition']
        else:
            # if partner items have separate nutrition keys, attempt to gather them
            nutrition = {}
            for k in ('calories','protein','fat','carbs'):
                if k in it:
                    try:
                        nutrition[k] = float(it[k])
                    except Exception:
                        pass
            if nutrition:
                item['nutrition'] = nutrition
        # description/tags if present
        if 'description' in it:
            item['description'] = it.get('description')
        if 'tags' in it:
            item['tags'] = it.get('tags')
        grouped[hotel].append(item)
    # convert to list of vendor objects
    vendors = []
    for hotel, items in grouped.items():
        vendors.append({'vendorName': hotel, 'items': items})
    return vendors

def aggregate(vendor_menus):
    rows = []
    for v in vendor_menus:
        vendor = v.get("vendorName") or v.get("hotel") or "UNKNOWN"
        items = v.get("items", []) or []
        count = len(items)
        if count == 0:
            rows.append((vendor, 0, 0, 0, 0.0))
            continue
        total_cal = 0
        total_prot = 0
        total_price = 0
        for it in items:
            # robustly fetch numeric values with fallbacks
            total_cal += float((it.get("nutrition", {}) or {}).get("calories") or 0)
            total_prot += float((it.get("nutrition", {}) or {}).get("protein") or 0)
            try:
                total_price += float(it.get("price") or 0)
            except Exception:
                total_price += 0
        avg_cal = round(total_cal / count, 1) if count else 0.0
        rows.append((vendor, count, int(total_price), total_prot, avg_cal))
    return rows

def write_csv(rows, out_path):
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(["vendor", "item_count", "sum_price", "sum_protein_g", "avg_calories"])
        w.writerows(rows)

def write_sqlite(rows, db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("""
    CREATE TABLE IF NOT EXISTS vendor_aggregates (
      vendor TEXT,
      item_count INTEGER,
      sum_price INTEGER,
      sum_protein_g REAL,
      avg_calories REAL
    )""")
    c.execute("DELETE FROM vendor_aggregates")
    c.executemany("INSERT INTO vendor_aggregates VALUES (?,?,?,?,?)", rows)
    conn.commit()
    conn.close()

def main():
    vendor_menus = []
    vm_path = Path("data/vendor_menus.json")
    pm_path = Path("data/partner_menus.json")

    if vm_path.exists():
        try:
            vendor_menus = load_json(vm_path)
            if not isinstance(vendor_menus, list):
                print("Unexpected vendor_menus.json format (not a list); treating as empty")
                vendor_menus = []
        except Exception as e:
            print("Error loading vendor_menus.json:", e)
            vendor_menus = []

    if pm_path.exists():
        try:
            partner_items = load_json(pm_path)
            if isinstance(partner_items, list) and partner_items:
                partner_vendors = normalize_partner_items(partner_items)
                # Merge: extend items for vendors with matching vendorName (hotel), else append
                merged = {}
                for v in vendor_menus:
                    name = v.get('vendorName') or v.get('hotel') or None
                    if name:
                        merged[name] = {'vendorName': name, 'items': list(v.get('items', []) or [])}
                for pv in partner_vendors:
                    name = pv.get('vendorName')
                    if name in merged:
                        merged[name]['items'].extend(pv.get('items', []))
                    else:
                        merged[name] = pv
                vendor_menus = list(merged.values())
            else:
                # partner_menus.json exists but is empty or not a list
                pass
        except Exception as e:
            print("Error loading partner_menus.json:", e)

    if not vendor_menus:
        print("No vendor data found in vendor_menus.json or partner_menus.json")
        sys.exit(1)

    rows = aggregate(vendor_menus)
    out_csv = "data/aggregates.csv"
    out_db = "data/output.db"
    write_csv(rows, out_csv)
    write_sqlite(rows, out_db)
    print("Wrote", out_csv, "and", out_db)

if __name__ == "__main__":
    main()
