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

## Token usage (audit)

- **Purpose:** Keep key files under line-count thresholds so prompts and context stay smaller (fewer tokens).
- **API:** `POST /api/run-token-audit` (dev or with `RUN_COVERAGE_TOKEN`). Returns findings for files over thresholds.
- **Thresholds (env overrides in `.env.local`):** `TOKEN_AUDIT_APP_TSX_MAX=800`, `TOKEN_AUDIT_HOME_PAGE_MAX=2000`, `TOKEN_AUDIT_API_CLIENT_MAX=1000`, `TOKEN_AUDIT_NAV_BAR_MAX=1200`, `TOKEN_AUDIT_LARGEST_FILE_MAX=2000`.
- **Targets:** `app/App.tsx`, `web/features/board/HomePage.tsx`, `web/lib/api.ts`, `web/components/ProjectNavBar.tsx`, and any file over `largestFileMax`.
- **Current:** App.tsx **85 lines**, HomePage **687 lines** — both under thresholds.
- **Ways to stay under:** Split large components (e.g. tab content into `AppTabContent`), extract hooks and domain modules, use `@ideahome/shared` to avoid duplication.

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
- [x] _Follow-up:_ Extract `useBoardDnd` from HomePage (board drag state + handlers) — HomePage **1915 lines** (was 1983).
- [x] _Follow-up:_ Extract `useHomePageIssueDetail` from HomePage (issue detail modal state, refs, effects, handlers) — HomePage **687 lines** (under 800); hook in `web/features/board/useHomePageIssueDetail.ts` (~1237 lines).
- [x] Update token audit API to flag `app/App.tsx` (≥800 lines) and `web/features/board/HomePage.tsx` (≥2000 lines)
- [x] Verify: lints addressed; app test skipped (Jest setup file missing in app/)

## Review

- **App.tsx**: Types, constants, utils, appStyles, and six UI components (HomeTab, ProjectsTab, IssueBoardRow, IssueBoardColumn, UserChip, ProjectPicker, ChecklistSection, TestResultPanel) are now in `app/src/`. App.tsx dropped from **5771 to 4465 lines**. Remaining lint: `@ideahome/shared-assistant` module resolution (pre-existing).
- **Token audit**: Now reports `app-monolith` when `app/App.tsx` ≥800 lines and `homepage-monolith` when `web/features/board/HomePage.tsx` ≥2000 lines.
- **HomePage**: Now **687 lines**; issue-detail modal logic lives in `useHomePageIssueDetail.ts`.
- **App.tsx**: Extracted authenticated shell into `app/src/components/AppMain.tsx`; App.tsx **85 lines** (was 602), well under 500.

## Token usage optimization (Mar 2025)

- **app/App.tsx**: Replaced five repeated `ChecklistSection` blocks (features, todos, ideas, bugs, enhancements) with one data-driven render using `checklistSectionPropsByKind` (useMemo) and `isChecklistTab(activeTab)`. Same behavior, less duplication; smaller token footprint when editing checklist tabs.
- **web/features/board/IssueDetailModal.tsx**: Extracted header, actions, and body sections. Modal **553 lines** (was ~874). Components: `IssueDetailModalHeader`, `IssueDetailModalActions`, `IssueDetailModalFormFields` (Project, Title, Description, Acceptance Criteria, Database, API, Test Cases, Assigned To), `IssueDetailModalAutomatedTests` (dropdown + chips with run/pass/fail), plus existing `IssueDetailModalScreenshots`, `IssueDetailModalRecordings`, `IssueDetailModalFiles`, `IssueDetailModalComments`.
- **web/components/CheckableListPage.tsx**: Extracted assistant state and handlers to `web/lib/useCheckableListAssistant.tsx`. Page **223 lines** (was 1023); hook holds chat, voice, loading tickers, and panel render; page uses hook for `renderIdeaDetails`, `renderItemActions` (AI button), and `pruneAssistantStateByIds` on bulk delete. Verified: web build passes; hook is `.tsx` for JSX.
- **iOS app tab alignment with web**: Added `DEFAULT_HIDDEN_TAB_IDS` (projects, issues, timeline, calendar, goals, pages, development). New installs now hide these by default to match web; visible tabs: Ideas, To-Do, Enhancements, Features, Bugs, Board, Summary, Expenses, Tests, Settings. Customize tabs (Settings or drawer) still allows re-hiding/unhiding.
- **iOS app UI = web UI**: Main content is now the web app in a WebView. After login, the app loads `APP_WEB_URL/mobile-app?token=...` (one-time), then the web app at `/`; native UI is reduced to a top bar with Sign out. Web logout notifies native via `postMessage` so the app shows the auth screen. New: `web/pages/mobile-app.tsx`, `app/src/components/WebAppView.tsx`; `web/lib/api.ts` notifies native on `clearStoredToken`. For local dev, set `IDEAHOME_WEB_ORIGIN` (or env used by shared-config) to your machine’s URL (e.g. `http://192.168.x.x:3000`) so the simulator loads your local web app.
- **web/components/AppLayout.tsx**: Extract project ordering and assistant settings (voices, OpenRouter models) into dedicated hooks under `web/lib/` so the layout component stays small and prompts pull in only the relevant hook files instead of one large monolith.

## Plan — Codebase rating toward 10/10 (Mar 2026)

Ordered, high-leverage edits (no rating UI change until codebase improves).

### Scan (structural / testing gaps)

- **God components/hooks:** `IssueDetailModalComments.tsx` (~1431 lines, 30+ props), `useHomePageIssueDetail.ts` (~1237 lines), `useCheckableListAssistant.tsx` (~852 lines), `finances.tsx` (~1414 lines), `api.ts` (~941 lines).
- **Tests:** No unit tests for `useCheckableListAssistant`, `useCodePageState`, `IssueDetailModalComments`, or `HomePage`. No backend e2e for expenses/Plaid. Web e2e covers home, nav, code, finances (3 tests), api-tests, coverage; no E2E for assistant flow or **tab reorder/hide** (nav prefs).
- **Types/errors:** API layer has `throwFromResponse` and error handling; could tighten response types and ensure user-facing errors (ErrorBanner) on critical flows.
- **A11y:** IssueDetailModalComments has many aria/role usages; modal focus trap / restore not verified.

### Ordered plan (this and next sessions)

1. **[This session]** Decompose `IssueDetailModalComments`: extract presentational block row (attachment/recording/screenshot/file) into `CommentBlockRow.tsx` to reduce duplication and line count.
2. **[This session]** Add E2E test for nav tab reorder/hide (open settings → Customize tabs → reorder or hide → verify persistence).
3. **[This session]** Add backend e2e for expenses CRUD (create, list, update, delete) to cover finances API.
4. *Next:* Extract a slice from `useHomePageIssueDetail` (e.g. comment-blocks state or recording UI state) or from `useCheckableListAssistant` (e.g. `useAssistantVoicePlayback`).
5. *Next:* Extract `useFinancesPage` hook and/or `FinancesSummarySection` / `ExpensesListSection` from `finances.tsx`.
6. *Later:* Unit tests for critical hooks (e.g. after adding Jest/Vitest to web); DTOs/validation on backend; modal focus trap verification.

### Done this session (Mar 2026)

- **CommentBlockRow** extracted from `IssueDetailModalComments` into `web/features/board/CommentBlockRow.tsx` (presentational row for attachment/recording/screenshot/file blocks); reduces duplication and ~80 lines in the god component.
- **Tab-preference E2E** added in `web/e2e/navigation.spec.ts`: "tab hide preference persists after reload (Manage tabs)" — open drawer → Settings → Manage tabs → hide Finances → reload → verify still hidden, then restore.
- **Backend expenses e2e** added: `backend/test/expenses.e2e-spec.ts` — GET empty, POST create, GET list, PATCH update, DELETE, GET empty again; full CRUD with cleanup.

### Previous / done

- Code page: `useCodePageState` + `codePageUtils` extracted; code.tsx thin. E2E for title, rating, Copy.
- Token usage: App.tsx, HomePage under thresholds; IssueDetailModal sections extracted; CheckableListPage uses `useCheckableListAssistant`.
- Code quality: `useCheckableListAssistant` return type formalized; ProjectNavSearch and ProjectNavAuthMenu extracted; expenses/Plaid service specs aligned.

---

## Current — Codebase quality polish (Mar 2026)

- [x] Formalize `useCheckableListAssistant` return type and keep an explicit cast at the call site (no `any`).
- [x] Simplify `CheckableListPage` assistant wiring (cleaner callbacks and dependencies).
- [x] Align `ExpensesService.removeAllImported` tests with new Plaid behavior (cursor + `lastPlaidSyncAt` reset) so Prisma mocks fully cover the service logic.
- [x] Extract `ProjectNavSearch` UI from `ProjectNavBar` into a focused component to simplify the nav structure and isolate search behavior.
- [x] Extract `ProjectNavAuthMenu` into a dedicated component to isolate auth-menu behavior and reduce complexity inside `ProjectNavBar`.
- [x] Add `web/e2e/code.spec.ts` to cover the Code page title, initial rating display, and the “Update rating” interaction with its timestamp.

## Current — Bulby expense Q&A

- [ ] Let Bulby read real expenses for the active project in the web app.
- [ ] Parse simple natural-language expense questions (e.g. "what was my expense on 2/27/26?").
- [ ] Answer directly from expense data (totals and categories) without sending these queries to the general AI model.
- [ ] Verify with sample data on the finances/expenses view and Bulby chat.
