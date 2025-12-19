#!/usr/bin/env python3
"""
Local fuzzy impute using data/indian_foods_nutrition.json as nutrition DB.

Improvements:
 - Extract calories from nested fields like macros.kcal (used in your JSON)
 - Fallbacks for several calorie key names
 - Writes data/items_enriched_local.csv/.parquet and updates metrics.json
"""
import json
from pathlib import Path
import argparse
import pandas as pd
from rapidfuzz import process, fuzz

ROOT = Path('.')
DATA_PARQUET = ROOT / 'data' / 'items.parquet'
NUT_JSON = ROOT / 'data' / 'indian_foods_nutrition.json'
OUT_CSV = ROOT / 'data' / 'items_enriched_local.csv'
OUT_PARQUET = ROOT / 'data' / 'items_enriched_local.parquet'
METRICS = ROOT / 'data' / 'metrics.json'

HIGH_THRESH = 90
MED_THRESH = 75

def normalize(s):
    if s is None:
        return ''
    return ' '.join(str(s).lower().strip().split())

def extract_calorie_from_record(r):
    # Try multiple possible locations / key names for calories
    if not isinstance(r, dict):
        return None
    # top-level obvious keys
    for k in ('calories','energy_kcal','energy_kcal_100g','calorie','energy','kcal'):
        if k in r:
            try:
                return float(r[k])
            except Exception:
                pass
    # nested 'macros' (your file uses macros.kcal)
    macros = r.get('macros') or r.get('macro') or {}
    if isinstance(macros, dict):
        if 'kcal' in macros:
            try:
                return float(macros.get('kcal'))
            except Exception:
                pass
    # nested 'nutriments' or 'nutrients' dictionary (OpenFoodFacts style)
    for nk in ('nutriments','nutrients'):
        nutr = r.get(nk)
        if isinstance(nutr, dict):
            # try specific keys
            for k in ('energy-kcal_serving','energy-kcal','energy-kcal_100g','energy_100g','kcal'):
                if k in nutr:
                    try:
                        return float(nutr.get(k))
                    except Exception:
                        pass
            # try any key that contains kcal/energy
            for k,v in nutr.items():
                if isinstance(k, str) and ('kcal' in k or 'energy' in k):
                    try:
                        return float(v)
                    except Exception:
                        pass
    return None

def load_nutrition_db(path):
    if not path.exists():
        return []
    j = json.loads(path.read_text(encoding='utf-8'))
    rows = []
    if isinstance(j, dict):
        # flatten any lists found under top-level keys
        for v in j.values():
            if isinstance(v, list):
                rows.extend(v)
            elif isinstance(v, dict):
                rows.append(v)
    elif isinstance(j, list):
        rows = j
    db = []
    for r in rows:
        # heuristic name keys
        name = r.get('name') or r.get('food') or r.get('title') or r.get('product_name') or r.get('item') or ''
        cal = extract_calorie_from_record(r)
        db.append({'name': normalize(name), 'calories': cal, 'raw': r})
    return db

def best_match(title, names):
    match = process.extractOne(title, names, scorer=fuzz.WRatio)
    if match:
        return match[0], match[1]
    return None, 0

def impute(df, db, vendors=None):
    names = [d['name'] for d in db]
    missing_mask = df['calories'].isnull()
    if vendors:
        vendors = [v.strip().lower() for v in vendors.split(',')]
        missing_mask &= df['vendor_name'].astype(str).str.lower().isin(vendors)
    rows = df[missing_mask]
    imputed = 0; scores=[]
    for idx, row in rows.iterrows():
        title = normalize(row.get('title') or row.get('item_id') or '')
        if not title:
            continue
        match_name, score = best_match(title, names)
        chosen_cal = None
        if match_name and score >= MED_THRESH:
            # find db entry
            for d in db:
                if d['name'] == match_name:
                    chosen_cal = d['calories']
                    break
        if chosen_cal is not None and score >= MED_THRESH:
            imputed += 1
            scores.append(score)
            df.at[idx, 'calories'] = chosen_cal
            df.at[idx, 'calories_imputed'] = True
            df.at[idx, 'calories_confidence'] = 0.9 if score >= HIGH_THRESH else 0.6
            df.at[idx, 'calories_source'] = 'local_indian_nutrition'
            df.at[idx, 'local_match_score'] = score
            df.at[idx, 'local_match_name'] = match_name
    avg_score = float(sum(scores)/len(scores)) if scores else 0.0
    return df, imputed, avg_score

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--vendors', type=str, default=None)
    args = parser.parse_args()

    if not DATA_PARQUET.exists():
        print("data/items.parquet not found")
        return
    db = load_nutrition_db(NUT_JSON)
    if not db:
        print("No entries loaded from", NUT_JSON)
        return
    print("Loaded nutrition DB entries:", len(db))

    df = pd.read_parquet(DATA_PARQUET)
    for c in ('calories_imputed','calories_confidence','calories_source','local_match_score','local_match_name'):
        if c not in df.columns:
            df[c] = None

    before = int(df['calories'].isnull().sum())
    print("Missing before:", before)
    df_new, imputed_count, avg_score = impute(df, db, vendors=args.vendors)
    after = int(df_new['calories'].isnull().sum())
    print("Imputed:", imputed_count, "Avg score:", avg_score)
    print("Missing after:", after)

    # write outputs (CSV always; parquet if possible)
    df_new.to_csv(OUT_CSV, index=False)
    try:
        df_new.to_parquet(OUT_PARQUET, index=False)
    except Exception as e:
        print("Parquet write error:", e)

    metrics = {}
    if METRICS.exists():
        try:
            metrics = json.loads(METRICS.read_text())
        except:
            metrics = {}
    metrics.update({
        'local_fuzzy_impute': {
            'imputed': int(imputed_count),
            'avg_score': float(avg_score),
            'before_missing': before,
                    'after_missing': after,
                    'vendors_filtered': args.vendors or 'ALL'
        }
    })
    METRICS.write_text(json.dumps(metrics, indent=2))
    print("Wrote outputs and updated metrics.json")

if __name__ == '__main__':
    main()
