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
| `GOOGLE_CLIENT_ID` | From Google Cloud | For Google SSO |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud | For Google SSO |
| `GITHUB_CLIENT_ID` | From GitHub | Optional – for GitHub SSO |
| `GITHUB_CLIENT_SECRET` | From GitHub | Optional |
| `APPLE_CLIENT_ID` | From Apple | Optional – for Apple SSO |
| `APPLE_*` | Various | Optional – see backend/docs/SSO-SETUP.md |

For `NEXT_PUBLIC_API_URL`, set it to your Vercel URL (e.g. `https://your-app.vercel.app`) so the frontend uses the same origin.

### 4. Database Migrations

Run migrations against your Vercel Postgres **before** deploying:

```bash
cd backend
DATABASE_URL="your-vercel-postgres-url" npx prisma migrate deploy
```

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
   - **Build Command**: `cd .. && pnpm install && pnpm build` (when root is `web`) or `pnpm build` (when root is repo)
   - **Output Directory**: `web/.next` (when root is repo) or `.next` (when root is `web`)
3. Enable **Include source files outside of the Root Directory** if Root Directory is `web`
4. Deploy

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
