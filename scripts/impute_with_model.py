#!/usr/bin/env python3
"""
Load models from models/ and impute missing calories in data/items.parquet.

- Writes data/items_enriched_model.csv and .parquet
- Marks calories_imputed_model, calories_source='model_regressor', calories_confidence=0.7
"""
from pathlib import Path
import pandas as pd
import joblib
import json

ROOT = Path('.')
DATA_PARQUET = ROOT / 'data' / 'items.parquet'
VECT_FILE = ROOT / 'models' / 'tfidf_vectorizer.joblib'
MODEL_FILE = ROOT / 'models' / 'ridge_regressor.joblib'
OUT_CSV = ROOT / 'data' / 'items_enriched_model.csv'
OUT_PARQUET = ROOT / 'data' / 'items_enriched_model.parquet'
METRICS_FILE = ROOT / 'data' / 'metrics.json'

def build_text_for_df(df):
    parts = []
    for _, r in df.iterrows():
        t = (str(r.get('title') or '') + ' ') + (str(r.get('vendor_name') or '') + ' ')
        if 'description' in r and not pd.isna(r['description']):
            t += str(r.get('description') or '') + ' '
        parts.append(t.strip())
    return parts

def main():
    if not DATA_PARQUET.exists():
        print("data/items.parquet not found")
        return
    if not VECT_FILE.exists() or not MODEL_FILE.exists():
        print("Model files missing. Run scripts/train_text_regressor.py first.")
        return

    vect = joblib.load(VECT_FILE)
    model = joblib.load(MODEL_FILE)

    df = pd.read_parquet(DATA_PARQUET)
    # ensure columns exist
    for c in ('calories_imputed_model','calories_source','calories_confidence','model_pred_calories'):
        if c not in df.columns:
            df[c] = None

    mask = df['calories'].isnull()
    to_impute = df[mask].copy()
    if to_impute.empty:
        print("No rows to impute.")
    else:
        texts = build_text_for_df(to_impute)
        X = vect.transform(texts)
        preds = model.predict(X)
        # assign preds
        df.loc[mask, 'model_pred_calories'] = preds
        # set as imputed calories
        df.loc[mask, 'calories'] = preds
        df.loc[mask, 'calories_imputed_model'] = True
        df.loc[mask, 'calories_source'] = 'model_regressor'
        # heuristic confidence
        df.loc[mask, 'calories_confidence'] = 0.7

    # write outputs
    df.to_csv(OUT_CSV, index=False)
    try:
        df.to_parquet(OUT_PARQUET, index=False)
    except Exception as e:
        print("Parquet write failed:", e)

    # update metrics
    metrics = {}
    if METRICS_FILE.exists():
        try:
            metrics = json.loads(METRICS_FILE.read_text())
        except Exception:
            metrics = {}
    metrics.update({
        'model_impute': {
            'imputed_count': int(mask.sum()),
            'calories_source': 'model_regressor'
        }
    })
    METRICS_FILE.write_text(json.dumps(metrics, indent=2))
    print("Wrote outputs:", OUT_CSV, "and attempted parquet:", OUT_PARQUET)

if __name__ == "__main__":
    main()
