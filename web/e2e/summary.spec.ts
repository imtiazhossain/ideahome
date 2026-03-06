import { expect, test, type Page } from "@playwright/test";

type SeedOptions = {
  todos?: unknown[];
  ideas?: unknown[];
  features?: unknown[];
  enhancements?: unknown[];
  bugs?: unknown[];
  expenses?: unknown[];
  calendarStatus?: Record<string, unknown>;
  calendarEvents?: unknown[];
};

async function seedAuthAndSummaryMocks(
  page: Page,
  {
    todos = [],
    ideas = [],
    features = [],
    enhancements = [],
    bugs = [],
    expenses = [],
    calendarStatus = {
      connected: true,
      selectedCalendarId: "primary",
      lastSyncedAt: new Date().toISOString(),
      connectedAt: new Date().toISOString(),
    },
    calendarEvents = [],
  }: SeedOptions = {}
) {
  await page.addInitScript(() => {
    localStorage.setItem("ideahome_token", "e2e-token");
    sessionStorage.setItem("ideahome_token_session", "e2e-token");
    document.cookie = "ideahome_token=e2e-token; Path=/; SameSite=Lax";
  });

  await page.route("**/projects*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "proj-summary", name: "Summary Project" }]),
    });
  });

  await page.route("**/issues*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/users/me/appearance", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        lightPreset: "classic",
        darkPreset: "classic",
      }),
    });
  });

  await page.route("**/users/me/bulby-memory", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 1,
        systemPrompt: "",
        orgContext: {
          product: "",
          architecture: "",
          apps: [],
          coreDomains: [],
          stack: [],
          constraints: [],
        },
        notes: [],
        ruleEntries: [],
        rulesFileMarkdown: "",
        updatedAtIso: new Date().toISOString(),
      }),
    });
  });

  await page.route("**/ideas/elevenlabs-voices", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/expenses*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(expenses),
    });
  });

  await page.route("**/calendar/google/status*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(calendarStatus),
    });
  });

  await page.route("**/calendar/events*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(calendarEvents),
    });
  });

  await page.route("**/api/ui-tests*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          file: "summary.spec.ts",
          suites: [
            {
              name: "Summary",
              tests: ["renders dashboard", "shows empty state"],
            },
          ],
        },
      ]),
    });
  });

  const routes: Array<[string, unknown[]]> = [
    ["**/todos*", todos],
    ["**/ideas*", ideas],
    ["**/features*", features],
    ["**/bugs*", bugs],
  ];

  for (const [pattern, body] of routes) {
    await page.route(pattern, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
  }

  await page.addInitScript((value) => {
    localStorage.setItem("ideahome-enhancements-list", JSON.stringify(value));
  }, enhancements);
}

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("Summary page", () => {
  test("opens from nav and renders the progress dashboard", async ({
    page,
  }) => {
    await seedAuthAndSummaryMocks(page, {
      todos: [
        {
          id: "todo-1",
          name: "Launch landing page",
          done: true,
          order: 0,
          projectId: "proj-summary",
          createdAt: new Date().toISOString(),
        },
        {
          id: "todo-2",
          name: "Fix auth edge case",
          done: false,
          order: 1,
          projectId: "proj-summary",
          createdAt: new Date().toISOString(),
        },
      ],
      ideas: [
        {
          id: "idea-1",
          name: "Referral flow",
          done: false,
          order: 0,
          projectId: "proj-summary",
          createdAt: new Date().toISOString(),
        },
      ],
      features: [
        {
          id: "feature-1",
          name: "Billing dashboard",
          done: true,
          order: 0,
          projectId: "proj-summary",
          createdAt: new Date().toISOString(),
        },
      ],
      enhancements: [
        {
          id: "enh-1",
          name: "Faster sync",
          done: true,
          order: 0,
          projectId: "proj-summary",
          createdAt: new Date().toISOString(),
        },
      ],
      bugs: [
        {
          id: "bug-1",
          name: "Broken mobile nav",
          done: false,
          order: 0,
          projectId: "proj-summary",
          createdAt: new Date().toISOString(),
        },
      ],
      expenses: [
        {
          id: "expense-1",
          amount: 240,
          description: "API monitoring",
          date: new Date().toISOString(),
          category: "Software",
          projectId: "proj-summary",
          createdAt: new Date().toISOString(),
        },
      ],
      calendarEvents: [
        {
          id: "event-1",
          provider: "google",
          providerEventId: "evt-1",
          title: "Weekly sync",
          description: null,
          startAt: new Date(Date.now() + 86400000).toISOString(),
          endAt: new Date(Date.now() + 90000000).toISOString(),
          isAllDay: false,
          projectId: "proj-summary",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    await page.goto("/");
    await page.getByRole("link", { name: "Summary" }).click();

    await expect(page).toHaveURL(/\/summary/);
    await expect(page.locator(".summary-page-title")).toHaveText("Summary");
    await expect(page.locator(".summary-hero-title")).toContainText(
      "Summary Project"
    );
    await expect(page.locator(".summary-stat-grid")).toBeVisible();
    await expect(page.locator(".summary-chart-grid")).toBeVisible();
    await expect(page.locator(".summary-supplemental-grid")).toBeVisible();
    await expect(page.locator(".summary-detail-grid")).toBeVisible();
    await expect(page.locator(".summary-snapshot-grid")).toBeVisible();

    await page.getByRole("link", { name: "Open Blockers" }).click();
    await expect(page).toHaveURL(/\/bugs/);
  });

  test("shows empty-state guidance when project has no tracked work", async ({
    page,
  }) => {
    await seedAuthAndSummaryMocks(page);
    await page.goto("/summary");

    await expect(page.locator(".summary-page-title")).toHaveText("Summary");
    await expect(page.locator(".summary-empty-state h2")).toHaveText(
      "No project data yet"
    );
    await expect(page.locator(".summary-empty-state")).toContainText(
      "Add to-dos, features, ideas, enhancements, or bugs"
    );
  });
});
