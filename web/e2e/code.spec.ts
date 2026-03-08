import { test, expect } from "@playwright/test";

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("Code page", () => {
  async function seedAuth(page: import("@playwright/test").Page) {
    await page.addInitScript(() => {
      localStorage.setItem("ideahome_token", "e2e-token");
      sessionStorage.setItem("ideahome_token_session", "e2e-token");
      document.cookie = "ideahome_token=e2e-token; Path=/; SameSite=Lax";
    });
  }

  async function mockProjectsApi(page: import("@playwright/test").Page) {
    await page.route("**/projects*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "proj-e2e",
            name: "E2E Project",
            order: 0,
            organizationName: null,
            qualityScoreConfig: null,
          },
        ]),
      });
    });
  }

  async function mockAppBootstrapApi(page: import("@playwright/test").Page) {
    await page.route("http://localhost:3001/**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    });

    const emptyListRoutes = [
      /\/todos(?:\?.*)?$/,
      /\/ideas(?:\?.*)?$/,
      /\/features(?:\?.*)?$/,
      /\/bugs(?:\?.*)?$/,
    ];

    for (const pattern of emptyListRoutes) {
      await page.route(pattern, async (route) => {
        if (route.request().method() !== "GET") {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        });
      });
    }

    await page.route("**/ideas/elevenlabs-voices*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    });
  }

  async function mockPromptUsageApi(page: import("@playwright/test").Page) {
    await page.route("**/code/projects/*/prompt-usage/trend**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mode: "project",
          source: "all",
          points: [
            {
              timestamp: "2026-03-06T10:00:00.000Z",
              totalTokens: 90,
              promptTokens: 32,
              completionTokens: 58,
              promptCount: 1,
            },
            {
              timestamp: "2026-03-07T10:00:00.000Z",
              totalTokens: 66,
              promptTokens: 24,
              completionTokens: 42,
              promptCount: 1,
            },
          ],
        }),
      });
    });
    await page.route("**/code/projects/*/prompt-usage/mine**", async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          source: "all",
          entries: [
            {
              id: "evt-1",
              timestamp: "2026-03-07T10:00:00.000Z",
              source: "gpt-openai",
              promptText: "Fix login bug and return only the patch.",
              promptTokens: 24,
              completionTokens: 42,
              totalTokens: 66,
              promptWordCount: 8,
              efficiencyScore: 82,
              improvementHints: [
                "Lead with the exact task, then keep only the context that changes the answer.",
              ],
              breakdown: {
                brevity: 30,
                outputEfficiency: 24,
                redundancyPenalty: 15,
                instructionDensity: 13,
              },
            },
          ],
        }),
      });
    });
    await page.route("**/api/codex-prompt-usage", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          importedSessions: 3,
          points: [
            {
              timestamp: "2026-03-07T11:00:00.000Z",
              totalTokens: 48,
              promptTokens: 18,
              completionTokens: 30,
              promptCount: 1,
            },
          ],
          entries: [
            {
              id: "codex-1",
              timestamp: "2026-03-07T11:00:00.000Z",
              source: "codex-estimated",
              promptText: "Push the code",
              promptTokens: 18,
              completionTokens: 30,
              totalTokens: 48,
              promptWordCount: 3,
              efficiencyScore: 88,
              improvementHints: [
                "This prompt is already fairly lean. Keep the same direct structure.",
              ],
              breakdown: {
                brevity: 35,
                outputEfficiency: 26,
                redundancyPenalty: 15,
                instructionDensity: 12,
              },
            },
          ],
        }),
      });
    });
  }

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockAppBootstrapApi(page);
    await mockProjectsApi(page);
    await mockPromptUsageApi(page);
  });

  async function expandSecuritySection(page: import("@playwright/test").Page) {
    const section = page.locator(".code-page-security-section");
    const runButton = section.getByRole("button", { name: "Run security audit" });
    if (await runButton.isVisible().catch(() => false)) return;
    const securityToggle = section.locator(".tests-page-section-toggle-inline");
    await expect(securityToggle).toBeVisible();
    await securityToggle.click();
  }

  test("shows title and initial codebase rating", async ({ page }) => {
    await test.step("Navigate to code page", async () => {
      await page.goto("/code");
    });
    await test.step("Verify title and codebase rating section", async () => {
      await expect(page.locator(".code-page-title")).toHaveText("Code");
      await expect(
        page.getByRole("heading", { name: "Codebase Rating" })
      ).toBeVisible();
      await expect(
        page.locator(".code-page-rating-score-value").first()
      ).toContainText("/10");
    });
  });

  test("Codebase Rating section has staff prompt and Copy button", async ({
    page,
  }) => {
    await page.goto("/code");
    await expect(
      page.getByRole("heading", { name: "Codebase Rating" })
    ).toBeVisible();
    await expect(page.locator("#code-rating-prompt")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Suggestions to improve and keep this score high",
      })
    ).toBeVisible();
    await expect(
      page
        .locator(".code-page-rating")
        .getByRole("button", { name: "Copy" })
        .first()
    ).toBeVisible();
  });

  test("shows Release Notes section on Code page", async ({ page }) => {
    await page.goto("/code");
    await expect(
      page.locator(".code-page-release-notes-section .tests-page-section-title")
    ).toHaveText("Release Notes");
    await expect(page.locator(".code-page-release-notes-list")).toBeVisible();
  });

  test("shows Security section and run button", async ({ page }) => {
    await page.goto("/code");
    await expandSecuritySection(page);
    await expect(
      page.locator(".code-page-security-section .tests-page-section-title")
    ).toHaveText("Security");
  });

  test("Security section starts without inline errors", async ({ page }) => {
    await page.goto("/code");
    await expandSecuritySection(page);
    await expect(
      page.locator(".code-page-security-section .code-page-error-inline")
    ).toHaveCount(0);
  });

  test("Security audit click does not navigate away", async ({ page }) => {
    await page.route("**/api/run-security-audit*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          generatedAt: new Date().toISOString(),
          durationMs: 50,
          score: 9.4,
          summary: {
            critical: 0,
            high: 0,
            moderate: 1,
            low: 2,
            totalDependencies: 120,
          },
          findings: [],
        }),
      });
    });

    await page.goto("/code");
    await expandSecuritySection(page);

    const runButton = page
      .locator(".code-page-security-section")
      .getByRole("button", { name: "Run security audit" });
    await runButton.click();

    await expect(page).toHaveURL(/\/code$/);
    await expect(
      page.locator(".code-page-security-section .code-page-rating-score-value")
    ).toHaveText("9.4/10");
  });

  test("renders prompt usage tracker, personal prompt details, and copyable template", async ({
    page,
  }) => {
    await page.goto("/code");
    await expect(
      page.getByRole("heading", { name: "Prompt Efficiency Tracker" })
    ).toBeVisible();
    await expect(page.locator(".prompt-usage-chart")).toBeVisible();

    await page.getByRole("button", { name: "My prompts" }).click();
    await expect(page.getByRole("heading", { name: "Prompt Analysis" })).toBeVisible();
    await expect(page.locator(".prompt-usage-prompt-box").first()).toContainText(
      /Fix login bug|Push the code/
    );
    const templateCard = page.locator(".prompt-usage-template-card").first();
    await expect(templateCard).toContainText("Rewrite a Prompt for Efficiency");
    await expect(
      templateCard.getByRole("button", { name: "Upload media" })
    ).toBeVisible();
    await expect(templateCard).toContainText(
      "Add Screenshots or Screen Recordings"
    );
  });

  test("remembers maximized prompt tracker state after refresh", async ({
    page,
  }) => {
    await page.goto("/code");

    const promptUsageSection = page.locator(".prompt-usage-section");
    await expect(
      page.getByRole("heading", { name: "Prompt Efficiency Tracker" })
    ).toBeVisible();

    await page.evaluate(() => {
      localStorage.setItem(
        "ideahome-section-full-height:/code:none:code-token-usage",
        "1"
      );
    });

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Prompt Efficiency Tracker" })
    ).toBeVisible();

    await expect(promptUsageSection).toHaveAttribute(
      "data-full-height",
      "true"
    );
  });

  test("reordered sections hydrate cleanly and still minimize", async ({
    page,
  }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (
        /hydration|did not match|server-rendered HTML|Hydration failed/i.test(
          text
        )
      ) {
        hydrationErrors.push(text);
      }
    });

    await page.goto("/code");
    await expect(
      page.getByRole("heading", { name: "Prompt Efficiency Tracker" })
    ).toBeVisible();

    await page.evaluate(() => {
      const reordered = JSON.stringify([
        "code-release-notes",
        "code-repos",
        "code-audit",
        "code-security",
        "code-rating",
        "code-health",
        "code-wireframe",
        "code-project-flow",
        "code-token-usage",
      ]);
      localStorage.setItem("ideahome-code-section-order", reordered);
      localStorage.setItem("ideahome-code-section-order-proj-e2e", reordered);
    });

    await page.reload();
    await expect(
      page.locator(".code-page-release-notes-section .tests-page-section-title")
    ).toHaveText("Release Notes");
    await expect(hydrationErrors).toEqual([]);

    const promptUsageSection = page.locator(".prompt-usage-section");
    const maximizeButton = promptUsageSection.getByRole("button", {
      name: "Expand Section Height",
    });
    await maximizeButton.click();
    await expect(promptUsageSection).toHaveAttribute("data-full-height", "true");

    const minimizeButton = promptUsageSection.getByRole("button", {
      name: "Minimize Section Height",
    });
    await minimizeButton.click();
    await expect(promptUsageSection).toHaveAttribute("data-full-height", "false");
  });
});
