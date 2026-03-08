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
    title: "Section Resizing and Scroll Behavior",
    details:
      "Made collapsible sections resizable with internal scrolling to improve readability for long panels.",
  },
  {
    date: "2026-03-04",
    area: "Calendar",
    title: "Google Calendar OAuth Callback Hardening",
    details:
      "Fixed callback rewrites and state handling so production redirects are reliable and easier to debug.",
  },
  {
    date: "2026-03-04",
    area: "Deploy",
    title: "Vercel Build and Runtime Reliability",
    details:
      "Stabilized Vercel deploys by tightening build/install steps, dependency handling, and backend bundling behavior.",
  },
  {
    date: "2026-03-04",
    area: "Deploy",
    title: "Faster Web Build Pipeline",
    details:
      "Optimized web build flow and added guardrails for Vercel build command constraints.",
  },
  {
    date: "2026-03-04",
    area: "Projects",
    title: "Project Invites and Settings Updates",
    details:
      "Introduced project invite flows and expanded project settings UX.",
  },
  {
    date: "2026-03-04",
    area: "Finances",
    title: "Plaid Connect Flow Fix",
    details:
      "Updated Plaid connect so link tokens are fetched at click time for more reliable connections.",
  },
  {
    date: "2026-03-04",
    area: "Issues",
    title: "Quality Score Input Contract Fix",
    details:
      "Fixed issue creation to satisfy the quality score input contract and prevent validation failures.",
  },
  {
    date: "2026-03-04",
    area: "UI",
    title: "Empty-State Cleanup",
    details:
      "Refined empty-state layouts and hid list footer actions when no items are present.",
  },
  {
    date: "2026-03-04",
    area: "Code",
    title: "Release Notes Panel Added",
    details:
      "Added a dedicated Release Notes section so product and engineering updates are visible directly in the app.",
  },
  {
    date: "2026-03-03",
    area: "Platform",
    title: "Production API Base Fallback Fix",
    details:
      "Fixed production API base fallback behavior to avoid localhost CORS failures.",
  },
  {
    date: "2026-03-03",
    area: "Tests",
    title: "UI Test Suite Expansion",
    details:
      "Added a JetBlue homepage suite and strengthened web UI test coverage.",
  },
  {
    date: "2026-03-03",
    area: "Code",
    title: "Code/Tests Build Stability",
    details:
      "Repaired Code and Tests page type/build issues and fixed Vercel model import wiring.",
  },
  {
    date: "2026-03-03",
    area: "App",
    title: "Cross-Module Integration Release",
    details:
      "Shipped coordinated updates across Plaid, expenses, code module, app WebView tabs, finances, and project flow.",
  },
  {
    date: "2026-03-03",
    area: "Code",
    title: "Project Flow Diagram Refresh",
    details:
      "Improved the monorepo project-flow diagram with an explicit refresh action in the Code page.",
  },
  {
    date: "2026-03-01",
    area: "App",
    title: "Shared Web/Native Resources",
    details:
      "Shared core resources between web and native app and fixed related web build behavior.",
  },
  {
    date: "2026-03-01",
    area: "UI",
    title: "Drawer and Navigation Polish",
    details:
      "Aligned drawer rename behavior and refreshed project navigation hover/active/theme styling.",
  },
  {
    date: "2026-03-01",
    area: "Issues",
    title: "Issue Detail Tabs for Files and Recordings",
    details:
      "Added files/recordings tabs in issue details and improved supporting styles.",
  },
  {
    date: "2026-03-01",
    area: "App",
    title: "State and Search Improvements",
    details:
      "Improved app state hooks, project search, and issue screenshot/expense workflows.",
  },
  {
    date: "2026-03-01",
    area: "Code",
    title: "Security Audit in Code",
    details:
      "Added dependency vulnerability scanning and a security score summary to the Code page.",
  },
  {
    date: "2026-02-28",
    area: "Code",
    title: "Code Health Integrated",
    details:
      "Moved coverage into the Code page as the Code Health section and kept /coverage redirecting to /code.",
  },
  {
    date: "2026-02-25",
    area: "Tests",
    title: "UI Test Dashboard Refresh Controls",
    details:
      "Added live refresh and clearer status handling for UI test runs in the Tests page.",
  },
  {
    date: "2026-02-22",
    area: "Pages",
    title: "Page Builder Section Editing Improvements",
    details:
      "Improved section title/content editing flow and update handling in the Pages experience.",
  },
];
