#!/usr/bin/env python3
"""
Train a simple text regressor for calories.

- Reads data/train_labels_highconf.csv as training data.
- Uses TF-IDF on title + vendor_name + description (if present).
- Trains a Ridge regression (alpha CV).
- Saves model and vectorizer under models/.
- Prints train/test MAE and RMSE.

Usage:
  python3 scripts/train_text_regressor.py
"""
import json
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import RidgeCV
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib

ROOT = Path('.')
TRAIN_CSV = ROOT / 'data' / 'train_labels_highconf.csv'
MODELS_DIR = ROOT / 'models'
VECT_FILE = MODELS_DIR / 'tfidf_vectorizer.joblib'
MODEL_FILE = MODELS_DIR / 'ridge_regressor.joblib'
METRICS_FILE = ROOT / 'data' / 'metrics.json'

def build_text(df):
    parts = []
    for _, r in df.iterrows():
        t = (str(r.get('title') or '') + ' ') + (str(r.get('vendor_name') or '') + ' ')
        if 'description' in r and not pd.isna(r['description']):
            t += str(r.get('description') or '') + ' '
        parts.append(t.strip())
    return parts

def main():
    if not TRAIN_CSV.exists():
        print("Training CSV not found:", TRAIN_CSV)
        return

    df = pd.read_csv(TRAIN_CSV)
    df = df.dropna(subset=['calories'])
    if df.empty:
        print("No labeled rows to train on.")
        return

    texts = build_text(df)
    y = df['calories'].astype(float).values

    # TF-IDF
    vect = TfidfVectorizer(ngram_range=(1,2), max_features=10000)
    X = vect.fit_transform(texts)

    # train/test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # RidgeCV over a few alphas
    alphas = [0.1, 1.0, 10.0, 100.0]
    model = RidgeCV(alphas=alphas, scoring='neg_mean_absolute_error', cv=5)
    model.fit(X_train, y_train)

    # predict & metrics
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    # compute RMSE (compatibility across sklearn versions)
    rmse = float(mean_squared_error(y_test, y_pred)) ** 0.5

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(vect, VECT_FILE)
    joblib.dump(model, MODEL_FILE)

    print("Trained RidgeCV; best alpha:", model.alpha_)
    print(f"Test MAE: {mae:.3f}, RMSE: {rmse:.3f}")
    # update metrics.json
    metrics = {}
    if METRICS_FILE.exists():
        try:
            metrics = json.loads(METRICS_FILE.read_text())
        except Exception:
            metrics = {}
    metrics.update({
        'text_regressor': {
            'n_train': int(len(df)),
            'alpha': float(model.alpha_),
            'test_mae': float(mae),
            'test_rmse': float(rmse)
        }
    })
    METRICS_FILE.write_text(json.dumps(metrics, indent=2))
    print("Saved vectorizer and model to", MODELS_DIR)

if __name__ == "__main__":
    main()
