export type ReleaseNoteEntry = {
  date: string;
  title: string;
  details: string;
  area: string;
};

export const APP_RELEASE_NOTES: ReleaseNoteEntry[] = [
  {
    date: "2026-03-04",
    area: "Code",
    title: "Section resizing and scroll behavior",
    details:
      "Made collapsible sections resizable with internal scrolling to improve readability for long panels.",
  },
  {
    date: "2026-03-04",
    area: "Calendar",
    title: "Google Calendar OAuth callback hardening",
    details:
      "Fixed callback rewrites and state handling so production redirects are reliable and easier to debug.",
  },
  {
    date: "2026-03-04",
    area: "Deploy",
    title: "Vercel build and runtime reliability",
    details:
      "Stabilized Vercel deploys by tightening build/install steps, dependency handling, and backend bundling behavior.",
  },
  {
    date: "2026-03-04",
    area: "Deploy",
    title: "Faster web build pipeline",
    details:
      "Optimized web build flow and added guardrails for Vercel build command constraints.",
  },
  {
    date: "2026-03-04",
    area: "Projects",
    title: "Project invites and settings updates",
    details:
      "Introduced project invite flows and expanded project settings UX.",
  },
  {
    date: "2026-03-04",
    area: "Finances",
    title: "Plaid connect flow fix",
    details:
      "Updated Plaid connect so link tokens are fetched at click time for more reliable connections.",
  },
  {
    date: "2026-03-04",
    area: "Issues",
    title: "Quality score input contract fix",
    details:
      "Fixed issue creation to satisfy the quality score input contract and prevent validation failures.",
  },
  {
    date: "2026-03-04",
    area: "UI",
    title: "Empty-state cleanup",
    details:
      "Refined empty-state layouts and hid list footer actions when no items are present.",
  },
  {
    date: "2026-03-04",
    area: "Code",
    title: "Release Notes panel added",
    details:
      "Added a dedicated Release Notes section so product and engineering updates are visible directly in the app.",
  },
  {
    date: "2026-03-03",
    area: "Platform",
    title: "Production API base fallback fix",
    details:
      "Fixed production API base fallback behavior to avoid localhost CORS failures.",
  },
  {
    date: "2026-03-03",
    area: "Tests",
    title: "UI test suite expansion",
    details:
      "Added a JetBlue homepage suite and strengthened web UI test coverage.",
  },
  {
    date: "2026-03-03",
    area: "Code",
    title: "Code/tests build stability",
    details:
      "Repaired Code and Tests page type/build issues and fixed Vercel model import wiring.",
  },
  {
    date: "2026-03-03",
    area: "App",
    title: "Cross-module integration release",
    details:
      "Shipped coordinated updates across Plaid, expenses, code module, app WebView tabs, finances, and project flow.",
  },
  {
    date: "2026-03-03",
    area: "Code",
    title: "Project flow diagram refresh",
    details:
      "Improved the monorepo project-flow diagram with an explicit refresh action in the Code page.",
  },
  {
    date: "2026-03-01",
    area: "App",
    title: "Shared web/native resources",
    details:
      "Shared core resources between web and native app and fixed related web build behavior.",
  },
  {
    date: "2026-03-01",
    area: "UI",
    title: "Drawer and navigation polish",
    details:
      "Aligned drawer rename behavior and refreshed project navigation hover/active/theme styling.",
  },
  {
    date: "2026-03-01",
    area: "Issues",
    title: "Issue detail tabs for files and recordings",
    details:
      "Added files/recordings tabs in issue details and improved supporting styles.",
  },
  {
    date: "2026-03-01",
    area: "App",
    title: "State and search improvements",
    details:
      "Improved app state hooks, project search, and issue screenshot/expense workflows.",
  },
  {
    date: "2026-03-01",
    area: "Code",
    title: "Security audit in Code",
    details:
      "Added dependency vulnerability scanning and a security score summary to the Code page.",
  },
  {
    date: "2026-02-28",
    area: "Code",
    title: "Code Health integrated",
    details:
      "Moved coverage into the Code page as the Code Health section and kept /coverage redirecting to /code.",
  },
  {
    date: "2026-02-25",
    area: "Tests",
    title: "UI test dashboard refresh controls",
    details:
      "Added live refresh and clearer status handling for UI test runs in the Tests page.",
  },
  {
    date: "2026-02-22",
    area: "Pages",
    title: "Page builder section editing improvements",
    details:
      "Improved section title/content editing flow and update handling in the Pages experience.",
  },
];
