```markdown
Simple quick steps to import vendor_menus.json

1. Ensure vendor_menus.json is at repo root.
2. Add file scripts/importVendorMenus.js (from above) into repo.
3. Run locally from repo root:

   - macOS / Linux:
     export DATABASE_URL="postgres://DB_USER:DB_PASS@DB_HOST:DB_PORT/DB_NAME"
     node scripts/importVendorMenus.js

   - Windows PowerShell:
     $env:DATABASE_URL="postgres://DB_USER:DB_PASS@DB_HOST:DB_PORT/DB_NAME"
     node scripts/importVendorMenus.js

4. After it runs, open Supabase → SQL Editor and run verification queries from next step.

Note: If your DB is Supabase, use the "Connection string" from Project Settings → Database → Connection string.
```