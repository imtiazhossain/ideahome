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
    title: "Release Notes panel added",
    details:
      "Added a dedicated Release Notes section so product and engineering updates are visible directly in the app.",
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
