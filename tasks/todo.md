# Tasks

## Current — Token usage optimization

- [x] Plan and document refactor
- [x] Decompose `app/App.tsx` (reduced from 5771 → 4465 lines)
  - [x] Extract types to `app/src/types.ts`
  - [x] Extract constants to `app/src/constants.ts`
  - [x] Extract auth/file/issue utils to `app/src/utils/*.ts`
  - [x] Extract `HomeTab`, `ProjectsTab` to `app/src/screens/`
  - [x] Extract `IssueBoardRow`, `IssueBoardColumn`, `UserChip`, `ProjectPicker`, `ChecklistSection`, `TestResultPanel` to `app/src/components/`
  - [x] Extract shared styles to `app/src/theme/appStyles.ts`
  - [x] Extract ExpensesTab, TestsTab, SettingsTab to `app/src/screens/*Tab.tsx` (App.tsx 4465 → 3990 lines)
- [ ] _Follow-up:_ Extract IssuesTab to get App.tsx further down; optionally `useAppState` for <500 lines
- [ ] Decompose `web/features/board/HomePage.tsx` (target: <800 lines) — extract `IssueDetailModal` (~2400 lines) in a follow-up
- [x] Update token audit API to flag `app/App.tsx` (≥800 lines) and `web/features/board/HomePage.tsx` (≥2000 lines)
- [x] Verify: lints addressed; app test skipped (Jest setup file missing in app/)

## Review

- **App.tsx**: Types, constants, utils, appStyles, and six UI components (HomeTab, ProjectsTab, IssueBoardRow, IssueBoardColumn, UserChip, ProjectPicker, ChecklistSection, TestResultPanel) are now in `app/src/`. App.tsx dropped from **5771 to 4465 lines**. Remaining lint: `@ideahome/shared-assistant` module resolution (pre-existing).
- **Token audit**: Now reports `app-monolith` when `app/App.tsx` ≥800 lines and `homepage-monolith` when `web/features/board/HomePage.tsx` ≥2000 lines.
- **Next steps**: (1) Extract `useAppState` and tab screens from App to reach <500 lines; (2) Decompose HomePage into `web/features/board/*` panels/hooks.
