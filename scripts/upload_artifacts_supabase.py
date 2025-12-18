#!/usr/bin/env python3
"""
Upload selected artifacts (models, CSV reports) to a Supabase storage bucket.
Requires: pip install supabase
Environment variables:
  SUPABASE_URL
  SUPABASE_SERVICE_KEY   (use service role key on server side)
Bucket name: 'artifacts' (create this in Supabase first)
"""
from pathlib import Path
import os, sys

try:
    from supabase import create_client
except Exception:
    print("supabase package not installed. Run: pip install supabase")
    sys.exit(1)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
bucket = "artifacts"

def upload_file(p: Path, dest_name: str):
    print(f"Uploading {p} -> {dest_name}")
    with p.open("rb") as fh:
        res = supabase.storage.from_(bucket).upload(dest_name, fh)
    print("Upload result:", res)

# Files to upload (adjust as needed)
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
        upload_file(p, p.name)
    else:
        print("Not found, skipping:", p)
print("Done.")
