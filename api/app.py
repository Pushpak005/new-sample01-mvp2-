#!/usr/bin/env python3
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import sqlite3
import os
import json

# Candidate DB / data locations
CANDIDATE_DB_PATHS = [
    os.path.join(os.path.dirname(__file__), "data", "output.db"),
    os.path.join(os.path.dirname(__file__), "..", "data", "output.db"),
    os.path.join(os.getcwd(), "data", "output.db"),
]

NUTRITION_JSON_PATHS = [
    os.path.join(os.path.dirname(__file__), "..", "data", "indian_foods_nutrition_sample.json"),
    os.path.join(os.getcwd(), "data", "indian_foods_nutrition_sample.json"),
]

VENDOR_MENUS_PATHS = [
    os.path.join(os.path.dirname(__file__), "..", "data", "vendor_menus.json"),
    os.path.join(os.getcwd(), "data", "vendor_menus.json"),
]

app = FastAPI(title="Healthy Diet - Smart API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

def find_existing(paths):
    for p in paths:
        if p and os.path.exists(p):
            return p
    return None

def get_db_path():
    p = find_existing(CANDIDATE_DB_PATHS)
    if not p:
        raise FileNotFoundError("output.db not found in expected locations.")
    return p

def get_conn():
    p = get_db_path()
    conn = sqlite3.connect(p)
    conn.row_factory = sqlite3.Row
    return conn

def load_json_cached(path_list, cache: Dict[str, Any], key: str):
    p = find_existing(path_list)
    if not p:
        return []
    mtime = os.path.getmtime(p)
    if cache.get(key + "_mtime") == mtime and cache.get(key) is not None:
        return cache[key]
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    cache[key] = data
    cache[key + "_mtime"] = mtime
    return data

GLOBAL_CACHE: Dict[str, Any] = {}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/vendors", response_model=List[Dict])
def list_vendors():
    try:
        conn = get_conn()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    cur = conn.cursor()
    cur.execute("SELECT vendor, item_count, sum_price, sum_protein_g, avg_calories FROM vendor_aggregates")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

@app.get("/vendors/{vendor_name}", response_model=Dict)
def vendor_detail(vendor_name: str):
    try:
        conn = get_conn()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    cur = conn.cursor()
    cur.execute("SELECT vendor, item_count, sum_price, sum_protein_g, avg_calories FROM vendor_aggregates WHERE vendor = ?", (vendor_name,))
    row = cur.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="vendor not found")
    return dict(row)

@app.get("/nutrition-lookup")
def nutrition_lookup(q: str = Query(..., min_length=1)):
    q_low = q.strip().lower()
    vendor_menus = load_json_cached(VENDOR_MENUS_PATHS, GLOBAL_CACHE, "vendor_menus")
    for vendor in vendor_menus:
        for item in vendor.get("items", []):
            if q_low in (item.get("title","").lower()):
                macros = item.get("nutrition") or {}
                return {"found": True, "tier": 1, "source": f"vendor:{vendor.get('vendorName')}", "macros": {
                    "kcal": macros.get("calories"),
                    "protein_g": macros.get("protein"),
                    "carbs_g": macros.get("carbs"),
                    "fat_g": macros.get("fat")
                }}
    nut = load_json_cached(NUTRITION_JSON_PATHS, GLOBAL_CACHE, "nutrition")
    for f in nut:
        if q_low in f.get("name","").lower():
            return {"found": True, "tier": 2, "source": "local_nutrition_db", "macros": {
                "kcal": f.get("calories"),
                "protein_g": f.get("protein_g"),
                "carbs_g": f.get("carbs_g"),
                "fat_g": f.get("fat_g")
            }}
    return {"found": False, "tier": 0, "source": None, "macros": {}}

@app.post("/score")
def score_item(payload: Dict):
    vitals = payload.get("vitals", {}) or {}
    item = payload.get("item", {}) or {}
    tags = [t.lower() for t in (item.get("tags") or [])]
    macros = item.get("macros") or {}
    llm_in = payload.get("llmScore")
    reasons = []
    score = 0.0

    bp_s = int(vitals.get("bpSystolic") or 0)
    bp_d = int(vitals.get("bpDiastolic") or 0)
    if bp_s >= 130 or bp_d >= 80:
        if "low-sodium" in tags:
            score += 12; reasons.append("low-sodium fits elevated BP")
        if "high-sodium" in tags:
            score -= 8; reasons.append("high-sodium not ideal for BP")

    calories_burned = int(vitals.get("calories_burned_today") or 0)
    if calories_burned > 400:
        if "high-protein" in tags or "high-protein-snack" in tags or (macros.get("protein_g") or 0) >= 12:
            score += 10; reasons.append("supports recovery after high activity")
        else:
            score += 1; reasons.append("activity suggests slightly higher needs")

    activity = (vitals.get("analysis") or {}).get("activityLevel","").lower()
    if activity == "low":
        if "light-clean" in tags or "low-calorie" in tags:
            score += 8; reasons.append("light meal suits low activity")
        else:
            score -= 3; reasons.append("may be heavy for low activity")

    prot = float(macros.get("protein_g") or macros.get("protein") or 0)
    if prot >= 15:
        score += 4; reasons.append("high protein content")
    kcal = float(macros.get("kcal") or macros.get("calories") or 0)
    if kcal and kcal <= 200:
        score += 3; reasons.append("low calorie per serving")

    for t in tags:
        bandit = GLOBAL_CACHE.get("tag_stats", {}).get(t, {"shown":0,"success":0})
        bandit_score = (bandit.get("success",0) + 1) / (bandit.get("shown",0) + 2)
        score += bandit_score * 1.5

    if isinstance(llm_in, (int, float)):
        score += float(llm_in) * 2
        reasons.append("llm score applied")

    if score < -20: score = -20
    if score > 100: score = 100

    return {"score": round(score, 2), "reasons": reasons, "llmScore": llm_in or 0.0}
# --- mock LLM endpoint (safe, offline) ---
from datetime import datetime

@app.post("/llm-mock")
def llm_mock(payload: dict):
    """
    Simple mock LLM: returns a small llmScore (-5..+5) and a human explanation string.
    Expects JSON: { "item": {...}, "vitals": {...} }
    """
    item = payload.get("item", {}) or {}
    vitals = payload.get("vitals", {}) or {}
    title = item.get("title", "item")
    tags = [t.lower() for t in (item.get("tags") or [])]
    macros = item.get("macros") or {}

    # small heuristic to simulate LLM output
    llm_score = 0.0
    reasons = []
    if "low-sodium" in tags:
        llm_score += 1.5
        reasons.append("low sodium recommended")
    if "high-protein" in tags or (macros.get("protein_g") or 0) >= 12:
        llm_score += 1.2
        reasons.append("protein supports recovery")
    # include vitals effect
    if (vitals.get("bpSystolic") or 0) >= 130:
        reasons.append("BP elevated — prefer lower salt")
        llm_score += 0.5
    # normalize to -5..5 (keep small)
    if llm_score > 5: llm_score = 5.0
    if llm_score < -5: llm_score = -5.0

    explanation = f"Mock LLM: {', '.join(reasons) or 'General healthy choice'} for {title}."
    return {"llmScore": round(llm_score,2), "explanation": explanation, "ts": datetime.utcnow().isoformat()}
