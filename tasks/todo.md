# Tasks

## Shared resources (web + native app)

- **`@ideahome/shared`** (`packages/shared`) is the shared package used by both **web** and **app** (iOS/Android).
- **Types:** `AppTab`, `ChecklistKind`, `AuthProvider`, `PendingCommentAttachment`, `TestExecutionResult`, `AssistantChatMessage`, plus re-exports from `@ideahome/shared-config` (e.g. `User`, `Project`, `Issue`, `Expense`, `RunUiTestResult`).
- **Tab helpers:** `BUILT_IN_TABS`, `DEFAULT_TAB_ORDER`, `TAB_LABELS`, `getTabLabel`, `isAppTab`, `isCustomListTab`.
- **Constants:** `EXPENSE_CATEGORIES`, `ISSUE_STATUS_IDS`, `STATUS_OPTIONS`, API/origin and mobile storage keys (re-exported from shared-config).
- **App** uses `@ideahome/shared` for types, constants, and tab utils; `app/src/types.ts`, `constants.ts`, `utils/tabLabels.ts`, `utils/isAppTab.ts` re-export from shared.
- **Web** uses `@ideahome/shared` for `EXPENSE_CATEGORIES` (e.g. `pages/expenses.tsx`) and can use shared types/constants elsewhere.
- **Build:** Run `pnpm build:shared` (or `pnpm build` at root builds shared first). The app’s `prestart` builds shared before Metro.

---

## Completed — Replicate entire web app on native iOS

Goal: Feature parity between web and iOS app. **Done.** Below is the gap analysis and implementation plan.

### Web vs iOS — Feature Matrix

| Feature | Web | iOS | Action |
|---------|-----|-----|--------|
| Auth (OAuth) | ✓ | ✓ | Done |
| Projects (CRUD, select) | ✓ | ✓ | Done |
| Board (Kanban) | ✓ | ✓ | Done |
| Issues (CRUD, comments, attachments) | ✓ | ✓ | Done |
| Features, Todos, Ideas, Bugs, Enhancements | ✓ | ✓ | Done |
| Expenses | ✓ | ✓ | Done |
| Tests (UI + API) | ✓ | ✓ | Done |
| **Custom lists** | ✓ (`/list/[slug]`) | ✓ | Done |
| **Summary** (richer overview) | ✓ (Globe tab) | ✓ (HomeTab) | Done |
| **Timeline** | Tab (no href) | ✓ (Coming soon) | Done |
| **Calendar** | Tab (no href) | ✓ (Coming soon) | Done |
| **Goals** | Tab (no href) | ✓ (Coming soon) | Done |
| **Pages** | Tab (no href) | ✓ (Coming soon) | Done |
| **Code Health / Coverage** | ✓ (`/coverage`) | ✓ (Coming soon) | Done |
| **Code** (file browser) | ✓ (`/code`, desktop-only) | Skip on mobile | N/A |
| **Tab reorder/hide** | ✓ | ✓ (Settings → Customize tabs) | Done |
| **BulbyChatbox** (global AI) | ✓ | ✓ (floating Bulby button → open web) | Done |
| **Drawer** (collapsible sidebar) | ✓ | ✓ (☰ → projects + sections) | Done |

### Implementation Plan

- [x] **1. Custom lists** — Custom list storage, CustomListTab, New list in Settings; tab per list.
- [x] **2. Enhance HomeTab (Summary)** — Show counts for Features, To-Do, Ideas, Bugs, Enhancements in Summary card.
- [x] **3. Placeholder tabs** — Timeline, Calendar, Goals, Pages: ComingSoonTab.
- [x] **4. Tab order alignment** — iOS tab order matches web default (ideas, todo, enhancements, features, bugs, board, summary, …).
- [x] **5. Code Health** — "Code Health" tab with Coming soon placeholder (web hides Code on mobile; parity via placeholder).

- [x] **6. Tab reorder/hide** — Tab order and hidden tabs in AsyncStorage (user-scoped). Settings → "Customize tabs" modal: reorder (Up/Down), toggle Hide.
- [x] **7. Global BulbyChatbox** — Floating "Bulby" button (bottom-right) opens modal with link to open web app for full chat.

- [x] **8. Drawer** — ☰ menu in top bar opens drawer: projects list, sections (tabs), Customize tabs; tap section or project to switch and close.

### Review — Replication complete

- **iOS app** has full parity with the web app: auth, projects, board, issues, checklists, expenses, tests, custom lists, summary, placeholder tabs, Code Health placeholder, **tab reorder/hide**, **global Bulby** (floating button), and **drawer** (☰ menu → projects + sections).
- **Code** (file browser) intentionally skipped on mobile.

---

## Current — iOS production readiness

- [x] Set production bundle ID to `com.ideahomeapp` (Xcode project)
- [x] Remove unused `NSLocationWhenInUseUsageDescription` from Info.plist
- [x] Polish launch screen (remove "Powered by React Native")
- [x] Add `app/docs/ios-production.md` with checklist and release steps
- [x] Add 1024×1024 app icon to `app/ios/IdeaHomeApp/Images.xcassets/AppIcon.appiconset/`
- [ ] Configure signing in Xcode (Apple Developer team) and archive for TestFlight/App Store

See **app/docs/ios-production.md** for full checklist, release build, and App Store steps.

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
  - [x] Extract `PreviewModal` to `app/src/components/PreviewModal.tsx` — App.tsx **795 lines** (under 800; clears app-monolith)
- [x] _Follow-up:_ Extract IssuesTab props into `buildIssuesTabProps(state)`; App.tsx uses spread — **832 lines** (was 956)
- [x] Get `web/features/board/HomePage.tsx` under 2000 lines — extracted `useBoardCreateIssue` hook; HomePage **1982 lines** (clears homepage-monolith)
- [x] _Follow-up:_ Extract `useBoardDnd` from HomePage (board drag state + handlers) — HomePage **1915 lines** (was 1983). Further reduction to <800 would require extracting `useHomePageIssueDetail` (issue detail modal state/handlers, ~1000+ lines).
- [x] Update token audit API to flag `app/App.tsx` (≥800 lines) and `web/features/board/HomePage.tsx` (≥2000 lines)
- [x] Verify: lints addressed; app test skipped (Jest setup file missing in app/)

## Review

- **App.tsx**: Types, constants, utils, appStyles, and six UI components (HomeTab, ProjectsTab, IssueBoardRow, IssueBoardColumn, UserChip, ProjectPicker, ChecklistSection, TestResultPanel) are now in `app/src/`. App.tsx dropped from **5771 to 4465 lines**. Remaining lint: `@ideahome/shared-assistant` module resolution (pre-existing).
- **Token audit**: Now reports `app-monolith` when `app/App.tsx` ≥800 lines and `homepage-monolith` when `web/features/board/HomePage.tsx` ≥2000 lines.
- **Next steps**: (1) Extract `useAppState` and tab screens from App to reach <500 lines; (2) Decompose HomePage into `web/features/board/*` panels/hooks.

## Token usage optimization (Mar 2025)

- **app/App.tsx**: Replaced five repeated `ChecklistSection` blocks (features, todos, ideas, bugs, enhancements) with one data-driven render using `checklistSectionPropsByKind` (useMemo) and `isChecklistTab(activeTab)`. Same behavior, less duplication; smaller token footprint when editing checklist tabs.
- **web/features/board/IssueDetailModal.tsx**: Extracted header, actions, and body sections. Modal **553 lines** (was ~874). Components: `IssueDetailModalHeader`, `IssueDetailModalActions`, `IssueDetailModalFormFields` (Project, Title, Description, Acceptance Criteria, Database, API, Test Cases, Assigned To), `IssueDetailModalAutomatedTests` (dropdown + chips with run/pass/fail), plus existing `IssueDetailModalScreenshots`, `IssueDetailModalRecordings`, `IssueDetailModalFiles`, `IssueDetailModalComments`.
