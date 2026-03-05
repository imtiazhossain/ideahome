import { expect, test, type Page } from "@playwright/test";

async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("ideahome_token", "e2e-token");
    sessionStorage.setItem("ideahome_token_session", "e2e-token");
    localStorage.removeItem("bulby-chatbox-trigger-hidden");
    localStorage.removeItem("bulby-chatbox-position");
    document.cookie = "ideahome_token=e2e-token; Path=/; SameSite=Lax";
  });
}

async function mockBulbyApis(page: Page) {
  const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "*",
  };

  await page.route("**/projects*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify([{ id: "proj-e2e", name: "E2E Project" }]),
    });
  });

  await page.route("**/todos*", async (route) => {
    const method = route.request().method();
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    if (method === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({
          id: "todo-e2e-1",
          projectId: "proj-e2e",
          name: "smoke item",
          done: false,
        }),
      });
      return;
    }
    if (method !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify([]),
    });
  });

  for (const resource of ["bugs", "features", "expenses"]) {
    await page.route(`**/${resource}*`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify([]),
      });
    });
  }

  await page.route("**/ideas*", async (route) => {
    const method = route.request().method();
    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: corsHeaders,
      });
      return;
    }
    if (method === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({ message: "Stubbed Bulby response." }),
      });
      return;
    }
    if (method !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify([]),
    });
  });
}

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("Bulby chatbox", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockBulbyApis(page);
  });

  test("keeps chat input focused after assistant response", async ({ page }) => {
    await page.route("**/ideas/assistant-chat*", async (route) => {
      const method = route.request().method();
      if (method === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "*",
          },
        });
        return;
      }
      if (method !== "POST") {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify({ message: "Stubbed Bulby response." }),
      });
    });

    await page.goto("/");

    await page.getByRole("button", { name: "Open Bulby chat" }).click();
    const panel = page.locator(".bulby-chatbox-panel").first();
    await expect(panel).toBeVisible();

    const input = panel.getByRole("textbox", { name: "Ask Bulby" }).first();
    await expect(input).toBeVisible();
    await input.fill("Give me a plan");
    await input.press("Enter");
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => document.activeElement?.getAttribute("aria-label") ?? ""
          ),
        { timeout: 500 }
      )
      .toBe("Ask Bulby");
  });

  test("keeps panel on-screen on mobile while Bulby is thinking", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/ideas/assistant-chat*", async (route) => {
      const method = route.request().method();
      if (method === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "*",
          },
        });
        return;
      }
      if (method !== "POST") {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1600));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify({ message: "Stubbed Bulby response." }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();
    const panel = page.locator(".bulby-chatbox-panel").first();
    await expect(panel).toBeVisible();

    const input = panel.getByRole("textbox", { name: "Ask Bulby" }).first();
    await input.fill("Give me a plan");
    await input.press("Enter");
    await expect(page.getByText("Thinking...", { exact: false })).toBeVisible();

    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
    }
  });
});
