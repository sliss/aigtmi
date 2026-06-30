# Handoff — ycomparator.stevenliss.com

## Current status

Site is **loading** but the "Tell me the odds" feature is **broken** (500 error). MongoDB cluster is gone and needs to be rebuilt. Everything else is ready to go.

## What's been done

- **Fixed DNS**: `ycomparator.stevenliss.com` had no A record in Cloudflare. Added one pointing to `76.76.21.21` (Vercel). Site serves again.
- **Scraped fresh YC data**: Added `scripts/scrapeYCCompanies.js`. Ran it — appended 1,635 new companies (through S26 batch) to the CSV. Dataset now has ~6,100 companies with descriptions.
- **Git note**: Local `main` has diverged from `origin/main` (1 local commit ahead, 13 behind). Run `git pull --rebase` before doing anything else to reconcile, then push.

## What's still broken

The API endpoint (`/api/calculate-prospect`) returns 500 because the MongoDB Atlas cluster is gone:

```
querySrv ENOTFOUND _mongodb._tcp.steve-projects.9bxzm.mongodb.net
```

The old cluster was `steve-projects.9bxzm.mongodb.net`. It no longer resolves — likely terminated after inactivity.

## Steps to fully restore

1. **Create a new MongoDB Atlas cluster** (free M0 is fine) at https://cloud.mongodb.com
   - Create a database user and whitelist `0.0.0.0/0` for Vercel
   - Get the new connection string (`mongodb+srv://...`)

2. **Update the connection string** in both places:
   - `.env` (for running scripts locally)
   - Vercel: `vercel env rm MONGODB_CONNECTION_STRING && vercel env add MONGODB_CONNECTION_STRING`

3. **Seed the database** — run the import script which reads the CSV, generates Nomic embeddings (512-dim, clustering), and inserts into MongoDB:
   ```bash
   node scripts/importCompanies.js
   ```
   Processes in batches of 50. Takes ~30–60 min for ~6,100 companies. Requires `NOMIC_KEY` and `MONGODB_CONNECTION_STRING` in `.env`.

4. **Create the vector search index** in Atlas UI:
   - Collection: `companies`
   - Index name: `vector_index`
   - Field: `embedding`, type: `vector`, dimensions: `512`, similarity: `cosine`

5. **Redeploy**:
   ```bash
   vercel --prod
   ```

## Env vars (all in .env, also set in Vercel)

| Variable | Purpose |
|---|---|
| `MONGODB_CONNECTION_STRING` | MongoDB Atlas — needs to be replaced with new cluster URL |
| `NOMIC_KEY` | Nomic Atlas API — used for generating embeddings |
| `OPENAI_API_KEY` | OpenAI — used for generating one-liner summaries (gpt-4o-mini) |

## Data files

| File | Description |
|---|---|
| `datasets/yc-companies-descriptions.csv` | Source data — 6,100+ companies with descriptions, now updated through S26 |
| `datasets/company_statuses_by_batch.csv` | Batch-level status aggregates (39 rows) |
| `exports/companies_with_prospect_scores.csv` | Pre-computed prospect scores from the original DB export — useful reference but missing embeddings |
