# IdeaHome (Monorepo)

Monorepo scaffold for the IdeaHome SaaS app (web, API, mobile).

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

Packages:
- backend: NestJS API + Prisma schema
- web: Next.js frontend
- mobile: Expo React Native app
