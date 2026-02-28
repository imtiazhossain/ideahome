# Idea Home Architecture

## Monorepo Layout
- `web`: Next.js web client.
- `backend`: NestJS API and Prisma data layer.
- `app`: React Native app.
- `packages/shared-config`: Shared constants, route builders, and shared types.

## Request Flow
1. `web` calls API helpers from `web/lib/api/*`.
2. Helpers call `backend` routes using shared path builders from `@ideahome/shared-config`.
3. `backend` modules validate org/user scope and read/write via Prisma.
4. Responses return normalized DTOs consumed by web and mobile clients.

## Web Composition
- Main board UI: `web/pages/index.tsx`.
- Board feature helpers/components: `web/features/board/*`.
- Layout shell and global navigation: `web/components/AppLayout.tsx`.
- Navigation tabs and ordering logic: `web/components/ProjectNavBar.tsx`.
- API entrypoints are grouped by concern in `web/lib/api/*` (`issues`, `projects`, `checklists`, `auth`, `media`, `tests`, `search`).

## Shared Package Boundaries
- Put only cross-app primitives in `packages/shared-config`:
  - route/path builders
  - stable constants
  - shared data types
  - pure utility functions
- Keep app-specific UI/state logic out of shared package.

## Token-Efficiency Rules
- Prefer feature folders over very large page files.
- Keep generated artifacts out of git (`coverage-report`, runtime `uploads`).
- Keep API modules domain-scoped to avoid loading one giant client file.
- When adding metadata lists (tests, fixtures), store them in dedicated modules and import only where needed.
