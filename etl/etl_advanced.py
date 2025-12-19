#!/usr/bin/env python3
"""
Advanced ETL (local prototype)

- Reads raw feeds:
  - data/vendor_menus.json    (vendor objects with 'items' lists)
  - data/partner_menus.json   (flat list of items with 'hotel' or 'vendor' field)
- Produces:
  - data/items.parquet        (canonical item-level table)
  - data/items.csv            (same, CSV for quick viewing)
  - data/vendor_aggregates.parquet and .csv
  - data/output.db            (vendor_aggregates table in SQLite)
  - data/metrics.json         (data quality / ingest metrics)
"""
import json
import csv
from pathlib import Path
from datetime import datetime
import hashlib
import sqlite3
import math
import pandas as pd

ROOT = Path('data')
ROOT.mkdir(exist_ok=True)

def load_json(path):
    p = Path(path)
    if not p.exists():
        return []
    return json.loads(p.read_text(encoding='utf-8'))

def normalize_vendor_name(name):
    if not name:
        return "unknown"
    s = str(name).strip().lower()
    # remove common suffix/prefix noise
    for token in ('menus','menu','menues','menus ','menu '):
        s = s.replace(token, '')
    s = ' '.join(s.split())  # collapse spaces
    return s

def vendor_id_from_name(name):
    # stable short id from normalized name
    ns = normalize_vendor_name(name)
    return hashlib.md5(ns.encode('utf-8')).hexdigest()[:8]

def coerce_price(val):
    if val is None or val == '':
        return None
    try:
        return int(float(val))
    except Exception:
        return None

def extract_nutrition(record):
    # Support nested nutrition dict OR top-level alternate fields
    n = {}
    if isinstance(record.get('nutrition'), dict):
        nd = record.get('nutrition')
        for k in ('calories','cal','energy'):
            if k in nd: n['calories'] = nd.get(k)
        for k in ('protein','prot'):
            if k in nd: n['protein'] = nd.get(k)
        for k in ('fat',):
            if k in nd: n['fat'] = nd.get(k)
        for k in ('carbs','carbohydrates'):
            if k in nd: n['carbs'] = nd.get(k)
    # top-level fallback keys
    for alt_cal in ('calories','cal','energy'):
        if alt_cal in record and 'calories' not in n:
            n['calories'] = record.get(alt_cal)
    for alt_prot in ('protein','prot'):
        if alt_prot in record and 'protein' not in n:
            n['protein'] = record.get(alt_prot)
    # coerce to floats when possible
    for k in list(n.keys()):
        try:
            n[k] = float(n[k]) if n[k] is not None and n[k] != '' else None
        except Exception:
            n[k] = None
    return n

def from_vendor_menus(vendor_list):
    items = []
    for v in vendor_list:
        vendor_name = v.get('vendorName') or v.get('hotel') or v.get('vendor') or 'unknown'
        v_norm = normalize_vendor_name(vendor_name)
        v_id = vendor_id_from_name(vendor_name)
        for i, it in enumerate(v.get('items', []) or []):
            item = {}
            item['vendor_id'] = v_id
            item['vendor_name'] = v_norm
            item['source'] = 'vendor_menus.json'
            item['source_index'] = i
            item['source_vendor_name'] = vendor_name
            item['item_id'] = it.get('id') or f"{v_id}-{i}"
            item['title'] = it.get('title') or it.get('name') or None
            item['description'] = it.get('description') or None
            item['price_cents'] = coerce_price(it.get('price'))
            item['category'] = it.get('category') or None
            item['tags'] = it.get('tags') if isinstance(it.get('tags'), list) else None
            nut = extract_nutrition(it)
            item['calories'] = nut.get('calories')
            item['protein'] = nut.get('protein')
            item['fat'] = nut.get('fat')
            item['carbs'] = nut.get('carbs')
            item['ingest_ts'] = datetime.utcnow().isoformat()
            items.append(item)
    return items

def from_partner_menus(flat_items):
    items = []
    for i, it in enumerate(flat_items):
        vendor_name = it.get('hotel') or it.get('vendor') or it.get('hotelName') or 'unknown'
        v_norm = normalize_vendor_name(vendor_name)
        v_id = vendor_id_from_name(vendor_name)
        item = {}
        item['vendor_id'] = v_id
        item['vendor_name'] = v_norm
        item['source'] = 'partner_menus.json'
        item['source_index'] = i
        item['source_vendor_name'] = vendor_name
        item['item_id'] = it.get('id') or it.get('item_id') or f"{v_id}-{i}"
        item['title'] = it.get('title') or it.get('name') or None
        item['description'] = it.get('description') or None
        item['price_cents'] = coerce_price(it.get('price'))
        item['category'] = it.get('category') or it.get('menu_category') or None
        item['tags'] = it.get('tags') if isinstance(it.get('tags'), list) else None
        nut = extract_nutrition(it)
        item['calories'] = nut.get('calories')
        item['protein'] = nut.get('protein')
        item['fat'] = nut.get('fat')
        item['carbs'] = nut.get('carbs')
        item['ingest_ts'] = datetime.utcnow().isoformat()
        items.append(item)
    return items

def write_parquet(df, path):
    df.to_parquet(path, index=False, engine='pyarrow')

def write_csv(df, path):
    df.to_csv(path, index=False)

def write_sqlite_vendor_aggregates(df_agg, db_path):
    conn = sqlite3.connect(db_path)
    df_agg.to_sql('vendor_aggregates', conn, if_exists='replace', index=False)
    conn.close()

def compute_metrics(df_items):
    total_items = len(df_items)
    vendors = df_items['vendor_id'].nunique()
    items_with_cal = df_items['calories'].notnull().sum()
    items_with_prot = df_items['protein'].notnull().sum()
    metrics = {
        'total_items': int(total_items),
        'vendors': int(vendors),
        'items_with_calories': int(items_with_cal),
        'items_with_protein': int(items_with_prot),
        'pct_with_calories': round(100.0 * items_with_cal / total_items, 2) if total_items else 0.0,
        'pct_with_protein': round(100.0 * items_with_prot / total_items, 2) if total_items else 0.0,
        'ingest_ts': datetime.utcnow().isoformat()
    }
    return metrics

def compute_vendor_aggregates(df_items):
    def price_bucket(p):
        if p is None or (isinstance(p, float) and math.isnan(p)):
            return 'unknown'
        if p < 100:
            return 'cheap'
        if p < 300:
            return 'medium'
        return 'expensive'
    df = df_items.copy()
    df['price_bucket'] = df['price_cents'].apply(price_bucket)
    agg = df.groupby(['vendor_id','vendor_name'], as_index=False).apply(lambda g: pd.Series({
        'item_count': len(g),
        'items_with_nutrition_count': int(g['calories'].notnull().sum()),
        'percent_with_nutrition': round(100.0 * g['calories'].notnull().sum() / len(g),2) if len(g) else 0.0,
        'avg_calories': float(g['calories'].dropna().mean()) if g['calories'].dropna().size else None,
        'median_calories': float(g['calories'].dropna().median()) if g['calories'].dropna().size else None,
        'min_calories': float(g['calories'].dropna().min()) if g['calories'].dropna().size else None,
        'max_calories': float(g['calories'].dropna().max()) if g['calories'].dropna().size else None,
        'sum_protein': float(g['protein'].dropna().sum()) if g['protein'].dropna().size else 0.0,
        'avg_protein': float(g['protein'].dropna().mean()) if g['protein'].dropna().size else None,
        'price_avg': float(g['price_cents'].dropna().mean()) if g['price_cents'].dropna().size else None,
        'price_median': float(g['price_cents'].dropna().median()) if g['price_cents'].dropna().size else None,
        'price_stddev': float(g['price_cents'].dropna().std()) if g['price_cents'].dropna().size else None,
        'cheap_pct': round(100.0 * (g['price_cents'].apply(price_bucket) == 'cheap').sum() / len(g),2) if len(g) else 0.0,
        'medium_pct': round(100.0 * (g['price_cents'].apply(price_bucket) == 'medium').sum() / len(g),2) if len(g) else 0.0,
        'expensive_pct': round(100.0 * (g['price_cents'].apply(price_bucket) == 'expensive').sum() / len(g),2) if len(g) else 0.0,
        'missing_nutrition_flag': bool(g['calories'].isnull().all()),
        'duplicated_vendor_flag': False
    })).reset_index()
    return agg

def main():
    print("Loading vendor_menus.json and partner_menus.json ...")
    vendor_list = load_json('data/vendor_menus.json')
    partner_items = load_json('data/partner_menus.json')

    items = []
    items.extend(from_vendor_menus(vendor_list))
    items.extend(from_partner_menus(partner_items))

    if not items:
        print("No items found. Exiting.")
        return

    df = pd.DataFrame(items)
    # Guarantee expected columns exist
    for c in ['vendor_id','vendor_name','item_id','title','price_cents','calories','protein','ingest_ts','source','source_index','source_vendor_name']:
        if c not in df.columns:
            df[c] = None

    # write item-level outputs
    items_parquet = ROOT / 'items.parquet'
    items_csv = ROOT / 'items.csv'
    print("Writing", items_parquet)
    write_parquet(df, items_parquet)
    print("Writing", items_csv)
    write_csv(df, items_csv)

    # compute metrics and aggregates
    metrics = compute_metrics(df)
    metrics_path = ROOT / 'metrics.json'
    Path(metrics_path).write_text(json.dumps(metrics, indent=2), encoding='utf-8')
    print("Wrote metrics:", metrics_path)

    agg = compute_vendor_aggregates(df)
    agg_parquet = ROOT / 'vendor_aggregates.parquet'
    agg_csv = ROOT / 'vendor_aggregates.csv'
    print("Writing", agg_parquet, agg_csv)
    write_parquet(agg, agg_parquet)
    write_csv(agg, agg_csv)

    # write to sqlite for quick API use
    db_path = ROOT / 'output.db'
    write_sqlite_vendor_aggregates(agg, str(db_path))
    print("Wrote SQLite vendor_aggregates to", db_path)

    print("Done. items:", len(df), "vendors:", df['vendor_id'].nunique())

if __name__ == '__main__':
    main()
