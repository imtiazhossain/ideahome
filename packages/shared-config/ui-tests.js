const UI_TESTS = [
  {
    file: "home.spec.ts",
    suites: [
      {
        name: "Idea Home home",
        tests: [
          "home page loads with title and app bar",
          "sidebar shows Idea Home and projects section; nav bar shows Board and Tests",
          "board shows status columns when no project selected",
          "drawer toggle collapses and expands sidebar",
          "Code Health nav link opens coverage page",
        ],
      },
      {
        name: "Create project",
        tests: [
          "opens create project modal and shows form",
          "create project with new organization",
          "validation shows error when project name is empty",
          "cancel closes create project modal",
        ],
      },
      {
        name: "Board search",
        tests: ["search input is visible and accepts text"],
      },
      {
        name: "Create Deck",
        tests: [
          "opens create deck modal",
          "create issue with title only",
          "validation shows error when title is empty",
          "cancel closes create deck modal",
        ],
      },
      {
        name: "Delete project",
        tests: ["delete button opens confirm modal and cancel closes it"],
      },
      {
        name: "Issue detail",
        tests: [
          "clicking issue card opens detail modal",
          "close button dismisses detail modal",
          "automated tests multi-select shows options and saves selection",
          "automated tests chip can be removed",
          "editing title and saving shows success",
          "issue card status dropdown changes status",
        ],
      },
      {
        name: "Run automated test",
        tests: [
          "nav Tests link opens tests page and run test modal",
          "run test modal can be closed",
        ],
      },
    ],
  },
  {
    file: "api-tests.spec.ts",
    suites: [
      {
        name: "API Tests page",
        tests: [
          "API Tests page loads with title and back link",
          "Back to Idea Home returns to home",
          "page shows test suites and test names",
          "run button for a test is visible and clickable",
        ],
      },
      {
        name: "Tests page",
        tests: [
          "Tests page shows Test Cases, API Tests, and Automated Tests sections",
          "Open API Tests link from Tests page goes to API tests",
        ],
      },
    ],
  },
  {
    file: "coverage.spec.ts",
    suites: [
      {
        name: "Code Coverage page",
        tests: [
          "coverage page has title, back link, and Run coverage button",
          "Back to Idea Home returns to home",
          "Run coverage button is clickable",
        ],
      },
    ],
  },
  {
    file: "navigation.spec.ts",
    suites: [
      {
        name: "Navigation",
        tests: [
          "Dashboard link in sidebar goes to home",
          "Board tab in nav goes to home",
          "Tests link in nav goes to tests page",
          "All projects shows board without project filter",
          "selecting a project in sidebar shows its name in nav",
        ],
      },
    ],
  },
];

module.exports = { UI_TESTS };
