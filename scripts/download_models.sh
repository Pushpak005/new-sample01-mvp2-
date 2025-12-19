#!/usr/bin/env bash
set -euo pipefail

# Usage:
# 1) Provide env vars SUPABASE_URL and SUPABASE_SERVICE_KEY
# 2) Either provide model object names as arguments:
#     ./scripts/download_models.sh artifacts/my_model.joblib artifacts/vec.joblib
#    or provide a file list via MODELS_LIST environment variable:
#     MODELS_LIST=tmp/models_to_download.txt ./scripts/download_models.sh
# 3) Optionally set BUCKET (default 'artifacts') and --force to overwrite existing files.

BUCKET="${BUCKET:-artifacts}"
FORCE=0

# parse args for --force
ARGS=()
for a in "$@"; do
  if [ "$a" = "--force" ]; then
    FORCE=1
  else
    ARGS+=("$a")
  fi
done

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_KEY:-}" ]; then
  echo "ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment"
  exit 2
fi

mkdir -p models tmp

# gather object list
objects=()
if [ -n "${MODELS_LIST:-}" ] && [ -f "$MODELS_LIST" ]; then
  while IFS= read -r line; do
    [[ -n "$line" ]] && objects+=("$line")
  done < "$MODELS_LIST"
fi

# add args passed on command line
for o in "${ARGS[@]}"; do objects+=("$o"); done

if [ "${#objects[@]}" -eq 0 ]; then
  echo "No model objects specified. Provide args or set MODELS_LIST to a file with one object per line."
  exit 1
fi

for obj in "${objects[@]}"; do
  # strip leading slash if any
  obj="${obj#/}"
  base="$(basename "$obj")"
  target="models/$base"

  if [ -f "$target" ] && [ "$FORCE" -ne 1 ]; then
    echo "Skipping existing: $target (use --force to overwrite)"
    continue
  fi

  echo "Requesting signed URL for: $obj"
  resp="$(curl -s -X POST "${SUPABASE_URL%/}/storage/v1/object/sign/${obj}" \
    -H "apikey: $SUPABASE_SERVICE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"expiresIn":3600}' || true)"

  # try to extract URL (handles both full URL and relative signedURL)
  signedURL="$(echo "$resp" | python3 -c "import sys, json; d=json.load(sys.stdin) if sys.stdin.read().strip() else {}; print(d.get('signedURL',''))" 2>/dev/null || true)"
  if [ -z "$signedURL" ]; then
    # fallback: try to find any http url in response
    signedURL="$(echo "$resp" | grep -oE 'https?://[^\" ]+' | head -n1 || true)"
  fi

  if [ -z "$signedURL" ]; then
    echo "ERROR: could not obtain signed URL for $obj. Response:"
    echo "$resp"
    continue
  fi

  # if returned path is relative, construct full URL
  if [[ "$signedURL" != http* ]]; then
    full="${SUPABASE_URL%/}/storage/v1${signedURL}"
  else
    full="$signedURL"
  fi

  echo "Downloading $obj -> $target"
  curl -sSL --fail "$full" -o "$target" || { echo "Failed to download $obj"; rm -f "$target"; continue; }
  echo "Saved $target"
done

echo "Done."
