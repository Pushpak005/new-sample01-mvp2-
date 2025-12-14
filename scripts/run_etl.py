#!/usr/bin/env python3
"""
Lightweight ETL without pandas (pure python csv).
Reads data/sample.csv (creates one if missing), groups by 'category' summing 'value',
and writes data/output/aggregated.csv
"""
import csv
from pathlib import Path
from collections import defaultdict

INPUT = Path("data/sample.csv")
OUTPUT_DIR = Path("data/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT = OUTPUT_DIR / "aggregated.csv"

def read_input(path):
    if not path.exists():
        sample = [
            ("category", "value"),
            ("A", "10"),
            ("B", "20"),
            ("A", "5"),
            ("C", "7"),
            ("B", "3"),
        ]
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", newline="") as f:
            writer = csv.writer(f)
            writer.writerows(sample)
        print(f"Created sample input at {path}")

    rows = []
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    return rows

def transform(rows):
    agg = defaultdict(float)
    for r in rows:
        cat = r.get("category") or r.get("Category") or ""
        val = r.get("value") or r.get("Value") or "0"
        try:
            v = float(val)
        except ValueError:
            v = 0.0
        agg[cat] += v
    # produce sorted list of dicts
    result = sorted([{"category": k, "value": int(v) if v.is_integer() else v} for k, v in agg.items()],
                    key=lambda x: x["value"], reverse=True)
    return result

def write_output(path, rows):
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["category", "value"])
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

def main():
    rows = read_input(INPUT)
    print("Input rows:", rows)
    out = transform(rows)
    write_output(OUTPUT, out)
    print(f"Wrote aggregated output to {OUTPUT}")
    print(out)

if __name__ == "__main__":
    main()
