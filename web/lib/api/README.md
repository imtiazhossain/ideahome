# Web API Modules

Use domain modules under `web/lib/api/*` instead of importing everything from `web/lib/api.ts`.

## Modules
- `auth.ts`: auth/session/user-scoped helpers.
- `projects.ts`: organizations/projects CRUD.
- `issues.ts`: issue + issue comment operations.
- `media.ts`: recordings/screenshots/files upload and URL helpers.
- `checklists.ts`: ideas/todos/bugs/features/enhancements APIs.
- `tests.ts`: test-run APIs.
- `search.ts`: search endpoints for nav/global search.
- `assistant.ts`: model/voice capability endpoints.

## Migration Rule
- New code should import from the narrowest domain module possible.
- Keep `web/lib/api.ts` as compatibility until all call sites are migrated.
