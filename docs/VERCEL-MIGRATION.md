# Vercel Migration Guide (Option C – Full Vercel)

This guide covers deploying IdeaHome entirely on Vercel with the backend running as serverless functions.

## Prerequisites

- Vercel account
- GitHub repo connected to Vercel
- Vercel Postgres (or Neon/Supabase) for database
- Vercel Blob for file storage (recordings, screenshots, attachments)

## Setup Steps

### 1. Create Vercel Postgres

1. In your Vercel project → **Storage** → **Create Database**
2. Choose **Postgres**
3. Connect it to your project
4. Copy the `POSTGRES_URL` (or `DATABASE_URL`) – you’ll use this as `DATABASE_URL`

### 2. Create Vercel Blob Store

1. In your Vercel project → **Storage** → **Create Store**
2. Choose **Blob**
3. Create a new Blob store
4. `BLOB_READ_WRITE_TOKEN` is added automatically to your project

### 3. Environment Variables

In **Vercel** → **Project** → **Settings** → **Environment Variables**, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `USE_BUILTIN_API` | `true` | Enables serverless backend |
| `DATABASE_URL` | From Vercel Postgres | Connection string (use pooled if available) |
| `BLOB_READ_WRITE_TOKEN` | From Vercel Blob | Auto-added when Blob store is created |
| `JWT_SECRET` | Random string | Generate with `openssl rand -hex 32` |
| `BACKEND_URL` | `https://your-app.vercel.app` | Same as app URL (API is same origin) |
| `FRONTEND_URL` | `https://your-app.vercel.app` | Your Vercel deployment URL |
| `NEXT_PUBLIC_API_URL` | `https://your-app.vercel.app` | **Required.** Same as app URL. Without it, the app calls `localhost` and shows "Load failed" on production (e.g. on mobile). |
| `GOOGLE_CLIENT_ID` | From Google Cloud | For Google SSO |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud | For Google SSO |
| `GITHUB_CLIENT_ID` | From GitHub | Optional – for GitHub SSO |
| `GITHUB_CLIENT_SECRET` | From GitHub | Optional |
| `APPLE_CLIENT_ID` | From Apple | Optional – for Apple SSO |
| `APPLE_*` | Various | Optional – see backend/docs/SSO-SETUP.md |

### 4. Database Migrations

Run migrations against your Vercel Postgres **before** deploying (and again whenever you add or change migrations):

```bash
cd backend
DATABASE_URL="your-vercel-postgres-url" npx prisma migrate deploy
```

Get the real URL from **Vercel** → **Project** → **Storage** → your **Postgres** database → **.env** tab or **Connection string**. Use that value for `DATABASE_URL`; do not use the placeholder from `.env.vercel.example`.

### 5. OAuth Redirect URIs

Update your OAuth app settings:

- **Google**: Add `https://your-app.vercel.app/auth/google/callback`
- **GitHub**: Add `https://your-app.vercel.app/auth/github/callback`
- **Apple**: Add `https://your-app.vercel.app/auth/apple/callback`

### 6. Deploy

1. Push to your connected branch
2. In Vercel Dashboard → **Settings**:
   - **Root Directory**: `web` (or leave empty and use root)
   - **Install Command**: `pnpm install` (run from repo root if root dir is empty)
   - **Build Command**: Use the command from `web/vercel.json` (includes `PRISMA_SKIP_POSTINSTALL_GENERATE=true` so Prisma does not warn about a missing schema at repo root; the backend still runs `prisma generate` in its own directory). If overriding, keep that env var for the install step.
   - **Output Directory**: `web/.next` (when root is repo) or `.next` (when root is `web`)
3. Enable **Include source files outside of the Root Directory** if Root Directory is `web`
4. Deploy

## Troubleshooting

### "Load failed" or "Failed to load projects" on production (e.g. on mobile)

The frontend is calling `http://localhost:3001` because `NEXT_PUBLIC_API_URL` is not set in Vercel. On a phone or another device, localhost is not your server, so the request fails.

**Fix:** In Vercel → Project → **Settings** → **Environment Variables**, add `NEXT_PUBLIC_API_URL` = `https://ideahome.vercel.app` (or your actual Vercel URL). Apply to Production (and Preview if needed), then redeploy.

### "We could not find your Prisma schema at `prisma/schema.prisma`" (postinstall warn)

The repo root has `@prisma/client` for the serverless build, but the schema lives in `backend/prisma/schema.prisma`. Prisma’s postinstall runs from root and warns. The build in `web/vercel.json` sets `PRISMA_SKIP_POSTINSTALL_GENERATE=true` for the install step so that warning is suppressed; the backend’s own `prisma generate` still runs from `backend/`. If you override the build command, include that env var for the install (e.g. `PRISMA_SKIP_POSTINSTALL_GENERATE=true pnpm install ...`).

### "Can't reach database server at `ep-xxx.region.postgres.vercel-storage.com`" (P1001)

Your app is using the **placeholder** `DATABASE_URL` from `.env.vercel.example`, not a real Vercel Postgres URL.

**Fix:** In Vercel → Project → **Settings** → **Environment Variables**, set `DATABASE_URL` to the **actual** connection string from your Postgres store:

1. Vercel Dashboard → your project → **Storage**
2. Open your **Postgres** database
3. Use the **.env** tab or **Connection string** and copy the URL (it will look like `postgres://default:...@ep-<id>-<region>.postgres.vercel-storage.com:5432/verceldb?sslmode=require` with real `ep-...` and region)
4. Paste that value as `DATABASE_URL` for Production (and Preview/Development if you use them)
5. Redeploy so the new env is picked up

## Build memory

If the build fails with "exceeded the amount of memory available":

1. **Enable Enhanced Builds** (Pro plan): Project → Settings → Build and Deployment → Build Machine → Enhanced (16 GB) or Turbo (60 GB).
2. **Hobby plan**: The build is optimized to skip the mobile package (`--filter backend --filter web`) and use `NODE_OPTIONS=--max-old-space-size=6144`. If it still fails, upgrade to Pro for Enhanced Builds.

## Root dependencies for built-in API

When using the built-in API, the Nest backend runs inside the Next.js serverless function and is loaded via `import("backend/serverless")`. At runtime, `backend/dist/serverless.js` resolves its dependencies (e.g. `express`) from the monorepo root `node_modules`. The root `package.json` therefore lists the backend’s runtime dependencies so they are installed at the root and available when the function runs on Vercel.

## Limitations

- **UI tests (Playwright)**: Not available on Vercel. Run locally with `pnpm dev:backend`.
- **API tests**: Not available on Vercel. Run locally with `pnpm test:e2e`.
- **Function timeout**: Vercel Pro allows 60s; Hobby is 10s. Most API calls should complete within this.

## Local Development with Built-in API

To test the full Vercel setup locally:

```bash
# Terminal 1: Database
pnpm db:up

# Terminal 2: Web with built-in API
USE_BUILTIN_API=true pnpm dev:web
```

Ensure `DATABASE_URL` points to your local Postgres. Without `BLOB_READ_WRITE_TOKEN`, files are stored on the local filesystem in `web/uploads/`.
