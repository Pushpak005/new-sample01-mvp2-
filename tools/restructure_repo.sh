#!/usr/bin/env bash
set -euo pipefail

mv_if_exists() {
  src="$1"
  dst="$2"
  if [ -e "$src" ]; then
    echo "Moving: $src -> $dst"
    mkdir -p "$(dirname "$dst")"
    git mv "$src" "$dst"
  else
    echo "Skip (not found): $src"
  fi
}

# Ensure directories exist
mkdir -p web web/backups netlify/functions scripts data models docs infra practice tools

# Web / frontend
mv_if_exists "admin.html" "web/admin.html"
mv_if_exists "index.html" "web/index.html"
mv_if_exists "review.js" "web/review.js"
mv_if_exists "app.js" "web/app.js"

# Move backup app.js files (if present)
for f in app.js.bak-*; do
  if [ -e "$f" ]; then
    mkdir -p web/backups
    git mv "$f" "web/backups/$f" || true
  fi
done

# Netlify functions (if some were in root)
mkdir -p netlify/functions
for f in assign-rider.js dynamic-pricing.js feedback.js get_metrics.js orders.js summarise.js score.js smart-recommendations.js recipes.js profile-tags.js; do
  if [ -e "$f" ]; then
    git mv "$f" "netlify/functions/$f" || true
  fi
done

# Scripts
mv_if_exists "scripts/upload_artifacts_supabase.py" "scripts/upload_artifacts_supabase.py"
mv_if_exists "scripts/seedsALL.js" "scripts/seedsALL.js"
mv_if_exists "scripts/app-loadPartnerMenus.txt" "scripts/app-loadPartnerMenus.txt"
mv_if_exists "import_vendors_to_supabase_Version3.js" "scripts/import_vendors_to_supabase_Version3.js"
mv_if_exists "scripts/setup-advanced.sh" "scripts/setup-advanced.sh"

# Docs
mv_if_exists "SUPABASE_SETUP.md" "docs/SUPABASE_SETUP.md"
mv_if_exists "PRODUCTION_DEPLOYMENT_GUIDE.md" "docs/PRODUCTION_DEPLOYMENT_GUIDE.md"
mv_if_exists "README_ADVANCED.md" "docs/README_ADVANCED.md"
mv_if_exists "README_DASHBOARD_INTEGRATION.md" "docs/README_DASHBOARD_INTEGRATION.md"
mv_if_exists "GO_LIVE_CHECKLIST.md" "docs/GO_LIVE_CHECKLIST.md"
mv_if_exists "ADVANCED_IMPLEMENTATION.md" "docs/ADVANCED_IMPLEMENTATION.md"
mv_if_exists "IMPLEMENTATION_SUMMARY.txt" "docs/IMPLEMENTATION_SUMMARY.txt"
mv_if_exists "IMPLEMENTATION_COMPLETE.md" "docs/IMPLEMENTATION_COMPLETE.md"

# Move any top-level data & models into their folders
if compgen -G "data/*" > /dev/null 2>&1; then
  mkdir -p data
  for f in data/*; do
    if [ -e "$f" ]; then git mv "$f" "data/$(basename "$f")" || true; fi
  done
fi

if compgen -G "models/*" > /dev/null 2>&1; then
  mkdir -p models
  for f in models/*; do
    if [ -e "$f" ]; then git mv "$f" "models/$(basename "$f")" || true; fi
  done
fi

# Practice / tests
mv_if_exists "practice" "practice"
mv_if_exists "practice/" "practice/"

echo "Finished moving. Run 'git status' to review changes."
