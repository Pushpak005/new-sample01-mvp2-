#!/usr/bin/env python3
"""
Upload artifacts with timestamped filenames to Supabase storage (keeps history).
Requires: pip install supabase
Env:
  SUPABASE_URL
  SUPABASE_SERVICE_KEY
Bucket: 'artifacts'
"""
from pathlib import Path
from datetime import datetime, timezone
import os, sys

try:
    from supabase import create_client
except Exception:
    print("Install supabase: pip install supabase")
    sys.exit(1)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
    sys.exit(1)

# normalize trailing slash
if not SUPABASE_URL.endswith("/"):
    SUPABASE_URL = SUPABASE_URL + "/"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
bucket = "artifacts"

def ts_name(p: Path):
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{p.stem}-{ts}{p.suffix}"

candidates = [
    Path("models/tfidf_vectorizer.joblib"),
    Path("models/ridge_regressor.joblib"),
    Path("data/final_calorie_report.csv"),
    Path("data/final_calorie_review_simple.csv"),
    Path("data/top50_low_confidence.csv"),
    Path("data/top50_biggest_diffs.csv"),
]

for p in candidates:
    if p.exists():
        dest = ts_name(p)
        print(f"Uploading {p} -> {dest}")
        with p.open("rb") as fh:
            res = supabase.storage.from_(bucket).upload(dest, fh)
        print("Result:", res)
    else:
        print("Not found, skipping:", p)
print("Done.")
