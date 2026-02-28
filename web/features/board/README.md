# Board Feature

Board-specific UI logic should live here instead of growing `web/pages/index.tsx`.

## Files
- `BoardDnd.tsx`: draggable issue card + droppable board column components.
- `issue-key.ts`: issue key formatting.
- `scoring.ts`: quality score calculation and color mapping.

## Guidelines
- Keep components presentational and side-effect light.
- Keep reusable board utilities pure and unit-testable.
- If a helper is used by backend and web, move it to `@ideahome/shared-config`.
