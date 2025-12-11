Healthy Diet — FREE-ONLY build + ENHANCED NUTRITION

What this does (no paid APIs, no keys):
- Wearable demo data (wearable_stream.json) polled every 60s.
- Smart picks update hourly (user can change frequency in Preferences).
- Multi-tier nutrition lookup via /api/nutrition-lookup:
  • Tier 1: Local Indian Food DB (40+ foods, instant, offline)
  • Tier 2: USDA FoodData Central (free, comprehensive)
  • Tier 3: OpenFoodFacts (community data)
  • Tier 4: Smart estimation (AI-powered fallback)
- Comprehensive nutrition tracking (macros + 6 key micronutrients).
- Nutrition Dashboard with AI-powered insights.
- Provenance shown on each card (source + model).

Deploy on Netlify (free):
1) Drag-drop this folder into Netlify (or connect a Git repo).
2) Ensure netlify.toml exists (already included). It routes /api/* to functions.
3) Done. No environment variables required.

How to test locally (quickest):
- Use Netlify CLI (optional): `npm i -g netlify-cli` then `netlify dev` in this folder.

NEW Features (Nutrition Service Upgrade):
- 📊 Nutrition Dashboard - Real-time macro/micro tracking
- 🇮🇳 Indian Food Database - 40+ verified foods with complete nutrition
- 📏 Portion Sizes - Visual guides and standard Indian portions
- 🤖 AI Insights - Personalized recommendations based on your data
- 🔄 Multi-tier Lookup - Always find nutrition data, even offline

Future upgrades (when you're ready, optional):
- Add USDA key in a new function for better macros.
- Add LLM explanation function for evidence-aware "Why?" (OpenAI key).
- Add payments (Razorpay/Stripe) for human nutritionist reviews.
- Barcode scanner for packaged foods.
- Meal planning and shopping lists.

Privacy & IP:
- Wearable data stays local in the browser.
- Nutrition data cached locally for offline use.
- No secrets in frontend; most APIs used are free and public.
- Your recommendation logic remains your IP.
