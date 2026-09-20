# Deploy Guide — Factory Resource Calculator

Stack: **React + Vite** (frontend) · **Vercel Functions** (API) · **Supabase** (DB + Storage)

---

## 1 · Supabase Setup

### 1.1 Create a project
1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **service_role key**
   (Dashboard → Settings → API)

### 1.2 Run the schema
Open **SQL Editor** in Supabase Dashboard and paste + run the contents of:
```
supabase/schema.sql
```
This creates 4 tables: `machines`, `recipes`, `stocks`, `stock_images`.

### 1.3 Create the Storage bucket
In Supabase Dashboard → **Storage** → New bucket:
- Name: `images`
- Public: ✅ (checked)

Or uncomment and run the INSERT at the bottom of `schema.sql`.

---

## 2 · Migrate existing data

Run the one-shot migration script to import all JSON data + upload images:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
npx tsx scripts/migrate-to-supabase.ts
```

This script:
- Uploads all machine/recipe/stock images from base64 → Supabase Storage
- Inserts all rows into the 4 tables
- Is idempotent — safe to re-run (uses upsert)

Expected output:
```
🚀  Starting migration to Supabase…
✅  Created storage bucket "images"
📦  Migrating machines… (27 rows)
🍫  Migrating recipes…  (N rows)
📊  Migrating stocks…   (N rows)
🖼️   Migrating stock images…
✅  Migration complete!
```

---

## 3 · Vercel Deployment

### 3.1 Install Vercel CLI (optional, for local testing)
```bash
npm install -g vercel
```

### 3.2 Link project
```bash
vercel link
# Follow prompts — select your Vercel team/project
```

### 3.3 Set environment variables in Vercel
In Vercel Dashboard → Your Project → Settings → **Environment Variables**, add:

| Variable                    | Value                                      |
|-----------------------------|-------------------------------------------|
| `SUPABASE_URL`              | `https://YOUR_PROJECT.supabase.co`        |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role key from Supabase) |

Set for **Production**, **Preview**, and **Development**.

### 3.4 Deploy
```bash
# Push to GitHub — Vercel auto-deploys on push to main
git push origin main

# Or deploy manually:
vercel --prod
```

---

## 4 · Local development (after migration)

```bash
# 1. Create .env.local at project root
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 2. Install all deps
npm install
npm install --prefix frontend

# 3. Run Vercel dev server (serves both frontend + API functions)
npx vercel dev
```

The `vercel dev` command:
- Serves the Vite frontend (builds and hot-reloads)
- Runs all `api/*.ts` files as local serverless functions
- Injects `.env.local` automatically

Access the app at: http://localhost:3000

---

## 5 · Project structure

```
pixels/
├── api/                        ← Vercel Functions (all API routes)
│   ├── lib/
│   │   ├── db.ts               ← Supabase client + CRUD helpers
│   │   ├── types.ts            ← Shared TypeScript types
│   │   ├── bomCalculator.ts    ← BOM explosion logic
│   │   ├── names.ts            ← Name deduplication
│   │   ├── time.ts             ← HH:MM:SS helpers
│   │   └── cors.ts             ← CORS headers helper
│   ├── recipes/
│   │   ├── index.ts            ← GET + POST /api/recipes
│   │   └── [id].ts             ← PUT + DELETE /api/recipes/:id
│   ├── machines/
│   │   ├── index.ts            ← GET + POST /api/machines
│   │   └── [id].ts             ← PUT + DELETE /api/machines/:id
│   ├── data.ts                 ← GET /api/data
│   ├── stocks.ts               ← POST /api/stocks
│   ├── stock-images.ts         ← GET /api/stock-images
│   ├── calculate.ts            ← POST /api/calculate
│   ├── plan.ts                 ← POST /api/plan
│   ├── diagnose.ts             ← GET /api/diagnose
│   ├── migrate.ts              ← POST /api/migrate
│   └── upload-image.ts         ← POST /api/upload-image
├── frontend/                   ← React + Vite app (unchanged UI)
├── supabase/
│   └── schema.sql              ← Run once in Supabase SQL Editor
├── scripts/
│   └── migrate-to-supabase.ts  ← One-shot data migration
├── vercel.json                 ← Vercel deployment config
├── tsconfig.json               ← TypeScript config for api/
└── .env.example                ← Template for environment variables
```

---

## 6 · Supabase Storage layout

```
images/
├── machines/   {machine_id}.jpg
├── recipes/    {recipe_id}.png
└── stocks/     {item_name}_{uuid}.png
```

All files are in the public `images` bucket — URLs are permanent and work without auth.

---

## 7 · Troubleshooting

**`SUPABASE_URL` not set error in function logs**
→ Check Vercel Environment Variables are saved and the deployment was triggered after adding them.

**Images not showing after migration**
→ Verify the `images` bucket is set to **Public** in Supabase Storage settings.

**`busboy` import error in upload-image.ts**
→ Ensure `busboy@1.6.0` is in root `package.json` dependencies (not devDependencies).

**Duplicate name error on recipe/machine create**
→ This is intentional — names must be unique across recipes, machines, and raw materials.

**Migration script: `unique constraint` error**
→ The schema has `ON CONFLICT DO NOTHING` semantics — data already migrated is skipped. Safe.
