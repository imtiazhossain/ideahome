# Idea Home (Monorepo)

Monorepo scaffold for the Idea Home SaaS app (web, API, mobile).

Quick dev:

```bash
# from repo root
pnpm install
pnpm dev:backend   # starts API on :3001
pnpm dev:web       # starts Next.js on :3000
pnpm dev:mobile    # starts Expo
```

Postgres (local dev)

```bash
# start local Postgres + Adminer
pnpm db:up
# copy .env.example -> .env (root and backend) so Prisma can connect
cp .env.example .env
# generate Prisma client and run migrations (from repo root)
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate
# open Adminer at http://localhost:8080 (user: postgres / postgres)
```

**SSO (Google, Apple, GitHub)**  
Sign-in and registration use OAuth. Add credentials to `backend/.env` (see **`backend/docs/SSO-SETUP.md`** for step-by-step and redirect URIs). Then open the web app at `/login` to sign in. After sign-in, the JWT is stored in the browser and sent with API requests.

**Dev: skip login**  
To work without signing in locally, set in `backend/.env`: `SKIP_AUTH_DEV=true`. Optionally set `DEV_USER_ID` to a user id; otherwise the first user in the DB is used. In `web/.env.local` set `NEXT_PUBLIC_SKIP_LOGIN_DEV=true` so the app doesn’t redirect to `/login`. Restart backend and web after changing env.

**Vercel deployment (single app)**  
Deploy web + backend together. See **`docs/VERCEL-MIGRATION.md`** for setup. Root Directory: `web`, set `USE_BUILTIN_API=true` and add `DATABASE_URL`, `JWT_SECRET`, etc.

Packages:
- backend: NestJS API + Prisma schema
- web: Next.js frontend
- mobile: Expo React Native app
