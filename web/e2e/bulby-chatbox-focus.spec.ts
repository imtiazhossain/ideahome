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

  await page.route("**/calendar/events**", async (route) => {
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

  test("answers latest expense questions from project expense data", async ({
    page,
  }) => {
    let assistantCalls = 0;

    await page.route("**/expenses*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify([
          {
            id: "expense-1",
            projectId: "proj-e2e",
            amount: 18.75,
            description: "Team lunch",
            date: "2026-03-01",
            category: "Meals",
            source: "manual",
            createdAt: "2026-03-01T14:00:00.000Z",
          },
          {
            id: "expense-2",
            projectId: "proj-e2e",
            amount: 9.5,
            description: "Coffee",
            date: "2026-03-03",
            category: "Meals",
            source: "plaid",
            createdAt: "2026-03-03T15:30:00.000Z",
          },
        ]),
      });
    });

    await page.route("**/ideas/assistant-chat*", async (route) => {
      assistantCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify({ message: "Generic assistant fallback." }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();

    const panel = page.locator(".bulby-chatbox-panel").first();
    const input = panel.getByRole("textbox", { name: "Ask Bulby" }).first();
    await input.fill("what was my latest expense?");
    await input.press("Enter");

    await expect(
      panel.getByText(
        "Your latest recorded expense was Coffee on March 3, 2026 in Meals for $9.50 imported from Plaid."
      )
    ).toBeVisible();
    expect(assistantCalls).toBe(0);
  });

  test("answers calendar questions from project calendar data", async ({
    page,
  }) => {
    let assistantCalls = 0;
    const now = new Date();
    const localEvent = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      15,
      0,
      0,
      0
    );

    await page.route("**/calendar/events**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify([
          {
            id: "calendar-event-1",
            provider: "google",
            providerEventId: "calendar-event-1",
            title: "Design review",
            description: null,
            location: null,
            startAt: localEvent.toISOString(),
            endAt: new Date(localEvent.getTime() + 30 * 60 * 1000).toISOString(),
            isAllDay: false,
            timeZone: "America/New_York",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: localEvent.toISOString(),
            updatedAt: localEvent.toISOString(),
          },
        ]),
      });
    });

    await page.route("**/ideas/assistant-chat*", async (route) => {
      assistantCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify({ message: "Generic assistant fallback." }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();

    const panel = page.locator(".bulby-chatbox-panel").first();
    const input = panel.getByRole("textbox", { name: "Ask Bulby" }).first();
    await input.fill("what events were on my calendar today?");
    await input.press("Enter");

    await expect(panel.getByText(/Design review/)).toBeVisible();
    expect(assistantCalls).toBe(0);
  });

  test("creates calendar events instead of relying on assistant text", async ({
    page,
  }) => {
    let assistantCalls = 0;
    let calendarCreateBody: { title?: unknown; isAllDay?: unknown } | null = null;

    await page.route("**/calendar/events**", async (route) => {
      const method = route.request().method();
      if (method === "POST") {
        calendarCreateBody = route.request().postDataJSON() as {
          title?: unknown;
          isAllDay?: unknown;
        };
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "*",
          },
          body: JSON.stringify({
            id: "calendar-created-1",
            provider: "google",
            providerEventId: "calendar-created-1",
            title: "Test on iPad",
            description: null,
            location: null,
            startAt: "2026-03-06T04:00:00.000Z",
            endAt: "2026-03-06T05:00:00.000Z",
            isAllDay: false,
            timeZone: "America/New_York",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: "2026-03-06T04:00:00.000Z",
            updatedAt: "2026-03-06T04:00:00.000Z",
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
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify([]),
      });
    });

    await page.route("**/ideas/assistant-chat*", async (route) => {
      assistantCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify({ message: "This should not be used." }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();

    const panel = page.locator(".bulby-chatbox-panel").first();
    const input = panel.getByRole("textbox", { name: "Ask Bulby" }).first();
    await input.fill("I want to add test on iPad at 11:00 p.m. to my calendar");
    await input.press("Enter");

    await expect(panel.getByText(/Added "Test on iPad" to your calendar/)).toBeVisible();
    expect(assistantCalls).toBe(0);
    expect(calendarCreateBody).not.toBeNull();
    if (!calendarCreateBody) throw new Error("Calendar create request was not captured");
    const requestBody = calendarCreateBody as {
      title?: unknown;
      isAllDay?: unknown;
    };
    expect(requestBody.title).toBe("Test on iPad");
    expect(requestBody.isAllDay).toBe(false);
  });

  test("time-only midnight requests schedule the next occurrence", async ({
    page,
  }) => {
    let calendarCreateBody: {
      title?: unknown;
      startAt?: unknown;
      endAt?: unknown;
      isAllDay?: unknown;
    } | null = null;

    await page.route("**/calendar/events**", async (route) => {
      const method = route.request().method();
      if (method === "POST") {
        calendarCreateBody = route.request().postDataJSON() as {
          title?: unknown;
          startAt?: unknown;
          endAt?: unknown;
          isAllDay?: unknown;
        };
        const startAt =
          typeof calendarCreateBody.startAt === "string"
            ? calendarCreateBody.startAt
            : new Date().toISOString();
        const endAt =
          typeof calendarCreateBody.endAt === "string"
            ? calendarCreateBody.endAt
            : new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "*",
          },
          body: JSON.stringify({
            id: "calendar-created-2",
            provider: "google",
            providerEventId: "calendar-created-2",
            title: "Go to sleep",
            description: null,
            location: null,
            startAt,
            endAt,
            isAllDay: false,
            timeZone: "America/New_York",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: startAt,
            updatedAt: startAt,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify([]),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();

    const panel = page.locator(".bulby-chatbox-panel").first();
    const input = panel.getByRole("textbox", { name: "Ask Bulby" }).first();
    await input.fill("add the event go to sleep at 12:00 a.m. to my calendar");
    await panel.getByRole("button", { name: "Send" }).click();

    if (!calendarCreateBody) throw new Error("Calendar create request was not captured");
    const requestBody = calendarCreateBody as {
      title?: unknown;
      startAt?: unknown;
      isAllDay?: unknown;
    };
    expect(requestBody.title).toBe("Go to sleep");
    expect(requestBody.isAllDay).toBe(false);
    expect(typeof requestBody.startAt).toBe("string");
    const scheduled = new Date(String(requestBody.startAt));
    const now = new Date();
    expect(scheduled.getTime()).toBeGreaterThan(now.getTime());
  });

  test("date-only calendar adds create all-day events without filler words", async ({
    page,
  }) => {
    let calendarCreateBody: {
      title?: unknown;
      isAllDay?: unknown;
      startAt?: unknown;
      endAt?: unknown;
    } | null = null;

    await page.route("**/calendar/events**", async (route) => {
      const method = route.request().method();
      if (method === "POST") {
        calendarCreateBody = route.request().postDataJSON() as {
          title?: unknown;
          isAllDay?: unknown;
          startAt?: unknown;
          endAt?: unknown;
        };
        const startAt = String(calendarCreateBody.startAt);
        const endAt = String(calendarCreateBody.endAt);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "*",
          },
          body: JSON.stringify({
            id: "calendar-created-3",
            provider: "google",
            providerEventId: "calendar-created-3",
            title: "Go to sleep",
            description: null,
            location: null,
            startAt,
            endAt,
            isAllDay: true,
            timeZone: "America/New_York",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: startAt,
            updatedAt: startAt,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify([]),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();

    const panel = page.locator(".bulby-chatbox-panel").first();
    const input = panel.getByRole("textbox", { name: "Ask Bulby" }).first();
    await input.fill("add go to sleep to my calendar today");
    await panel.getByRole("button", { name: "Send" }).click();

    await expect(panel.getByText(/Added "Go to sleep" to your calendar/)).toBeVisible();
    if (!calendarCreateBody) throw new Error("Calendar create request was not captured");
    const requestBody = calendarCreateBody as {
      title?: unknown;
      isAllDay?: unknown;
    };
    expect(requestBody.title).toBe("Go to sleep");
    expect(requestBody.isAllDay).toBe(true);
  });

  test("calendar follow-up time completes a pending create instead of using assistant text", async ({
    page,
  }) => {
    let assistantCalls = 0;
    let calendarCreateBody: {
      title?: unknown;
      startAt?: unknown;
      isAllDay?: unknown;
    } | null = null;

    await page.route("**/calendar/events**", async (route) => {
      const method = route.request().method();
      if (method === "POST") {
        calendarCreateBody = route.request().postDataJSON() as {
          title?: unknown;
          startAt?: unknown;
          isAllDay?: unknown;
        };
        const startAt =
          typeof calendarCreateBody.startAt === "string"
            ? calendarCreateBody.startAt
            : new Date().toISOString();
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "*",
          },
          body: JSON.stringify({
            id: "calendar-created-4",
            provider: "google",
            providerEventId: "calendar-created-4",
            title: "Go to sleep",
            description: null,
            location: null,
            startAt,
            endAt: new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString(),
            isAllDay: false,
            timeZone: "America/New_York",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: startAt,
            updatedAt: startAt,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify([]),
      });
    });

    await page.route("**/ideas/assistant-chat*", async (route) => {
      assistantCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify({ message: "This should not be used." }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();

    const panel = page.locator(".bulby-chatbox-panel").first();
    const input = panel.getByRole("textbox", { name: "Ask Bulby" }).first();
    await input.fill("add go to sleep to my calendar");
    await panel.getByRole("button", { name: "Send" }).click();

    await expect(panel.getByText(/Please specify the time/i)).toBeVisible();

    const followUp = panel.getByRole("textbox", { name: "Ask Bulby" }).first();
    await followUp.fill("11:59 p.m. today");
    await panel.getByRole("button", { name: "Send" }).click();

    await expect(panel.getByText(/Added "Go to sleep" to your calendar/)).toBeVisible();
    expect(assistantCalls).toBe(0);
    if (!calendarCreateBody) throw new Error("Calendar create request was not captured");
    const requestBody = calendarCreateBody as {
      title?: unknown;
      isAllDay?: unknown;
    };
    expect(requestBody.title).toBe("Go to sleep");
    expect(requestBody.isAllDay).toBe(false);
  });

  test("edits a matching calendar event instead of summarizing the day", async ({
    page,
  }) => {
    let assistantCalls = 0;
    let updateBody: { title?: unknown } | null = null;

    await page.route("**/calendar/events**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
            "access-control-allow-headers": "*",
          },
          body: JSON.stringify([
            {
              id: "calendar-event-edit-1",
              provider: "google",
              providerEventId: "calendar-event-edit-1",
              title: "Go to sleep",
              description: null,
              location: null,
              startAt: "2026-03-06T04:59:00.000Z",
              endAt: "2026-03-06T05:59:00.000Z",
              isAllDay: false,
              timeZone: "America/New_York",
              status: "confirmed",
              etag: null,
              updatedAtProvider: null,
              lastSyncedAt: null,
              createdAt: "2026-03-06T04:59:00.000Z",
              updatedAt: "2026-03-06T04:59:00.000Z",
            },
          ]),
        });
        return;
      }
      if (method === "PATCH") {
        updateBody = route.request().postDataJSON() as { title?: unknown };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
            "access-control-allow-headers": "*",
          },
          body: JSON.stringify({
            id: "calendar-event-edit-1",
            provider: "google",
            providerEventId: "calendar-event-edit-1",
            title: "Go to sleep now",
            description: null,
            location: null,
            startAt: "2026-03-06T04:59:00.000Z",
            endAt: "2026-03-06T05:59:00.000Z",
            isAllDay: false,
            timeZone: "America/New_York",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: "2026-03-06T04:59:00.000Z",
            updatedAt: "2026-03-06T05:00:00.000Z",
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.route("**/ideas/assistant-chat*", async (route) => {
      assistantCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify({ message: "This should not be used." }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();

    const panel = page.locator(".bulby-chatbox-panel").first();
    const input = panel.getByRole("textbox", { name: "Ask Bulby" }).first();
    await input.fill("edit the go to sleep event for today to go to sleep now");
    await panel.getByRole("button", { name: "Send" }).click();

    await expect(panel.getByText(/Updated your calendar event to "Go to sleep now"/)).toBeVisible();
    expect(assistantCalls).toBe(0);
    if (!updateBody) throw new Error("Calendar update request was not captured");
    const requestBody = updateBody as { title?: unknown };
    expect(requestBody.title).toBe("Go to sleep now");
  });

  test("deletes matching calendar events instead of returning a false success message", async ({
    page,
  }) => {
    let assistantCalls = 0;
    const deletedIds: string[] = [];

    await page.route("**/calendar/events**", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,DELETE,OPTIONS",
            "access-control-allow-headers": "*",
          },
          body: JSON.stringify([
            {
              id: "calendar-event-delete-1",
              provider: "google",
              providerEventId: "calendar-event-delete-1",
              title: "Go to sleep now",
              description: null,
              location: null,
              startAt: "2026-03-06T04:59:00.000Z",
              endAt: "2026-03-06T05:59:00.000Z",
              isAllDay: false,
              timeZone: "America/New_York",
              status: "confirmed",
              etag: null,
              updatedAtProvider: null,
              lastSyncedAt: null,
              createdAt: "2026-03-06T04:59:00.000Z",
              updatedAt: "2026-03-06T04:59:00.000Z",
            },
          ]),
        });
        return;
      }
      if (method === "DELETE") {
        const eventId = url.match(/\/calendar\/events\/([^?]+)/)?.[1];
        if (eventId) deletedIds.push(decodeURIComponent(eventId));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,DELETE,OPTIONS",
            "access-control-allow-headers": "*",
          },
          body: JSON.stringify({ deleted: true }),
        });
        return;
      }
      await route.continue();
    });

    await page.route("**/ideas/assistant-chat*", async (route) => {
      assistantCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify({ message: "This should not be used." }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();

    const panel = page.locator(".bulby-chatbox-panel").first();
    const input = panel.getByRole("textbox", { name: "Ask Bulby" }).first();
    await input.fill("delete the go to sleep now events");
    await panel.getByRole("button", { name: "Send" }).click();

    await expect(panel.getByText(/Deleted the matching calendar event/)).toBeVisible();
    expect(assistantCalls).toBe(0);
    expect(deletedIds).toEqual(["calendar-event-delete-1"]);
  });

  test("unsupported app mutations are refused instead of using fallback assistant text", async ({
    page,
  }) => {
    let assistantCalls = 0;

    await page.route("**/ideas/assistant-chat*", async (route) => {
      assistantCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify({ message: "This should not be used." }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();

    const panel = page.locator(".bulby-chatbox-panel").first();
    const input = panel.getByRole("textbox", { name: "Ask Bulby" }).first();
    await input.fill("move the therapy event to tomorrow");
    await panel.getByRole("button", { name: "Send" }).click();

    await expect(
      panel.getByText(/I couldn't complete that .*action/i)
    ).toBeVisible();
    expect(assistantCalls).toBe(0);
  });

  test("answers explicit calendar date questions from project calendar data", async ({
    page,
  }) => {
    let assistantCalls = 0;

    await page.route("**/calendar/events**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify([
          {
            id: "calendar-event-2",
            provider: "google",
            providerEventId: "calendar-event-2",
            title: "Therapy",
            description: null,
            location: null,
            startAt: "2026-03-02T19:00:00.000Z",
            endAt: "2026-03-02T20:00:00.000Z",
            isAllDay: false,
            timeZone: "America/New_York",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z",
          },
        ]),
      });
    });

    await page.route("**/ideas/assistant-chat*", async (route) => {
      assistantCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify({ message: "Generic assistant fallback." }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();

    const panel = page.locator(".bulby-chatbox-panel").first();
    const input = page.getByRole("textbox", { name: "Ask Bulby" }).first();
    await expect(input).toBeVisible();
    await input.fill("what was on my calendar on March 2nd?");
    await input.press("Enter");

    await expect(panel.getByText(/Therapy/)).toBeVisible();
    expect(assistantCalls).toBe(0);
  });

  test("answers weekly calendar questions from project calendar data", async ({
    page,
  }) => {
    let assistantCalls = 0;
    const now = new Date();
    const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + mondayOffset,
      10,
      0,
      0,
      0
    );
    const thursday = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + 3,
      14,
      0,
      0,
      0
    );

    await page.route("**/calendar/events**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify([
          {
            id: "calendar-week-1",
            provider: "google",
            providerEventId: "calendar-week-1",
            title: "Sprint planning",
            description: null,
            location: null,
            startAt: monday.toISOString(),
            endAt: new Date(monday.getTime() + 60 * 60 * 1000).toISOString(),
            isAllDay: false,
            timeZone: "America/New_York",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: monday.toISOString(),
            updatedAt: monday.toISOString(),
          },
          {
            id: "calendar-week-2",
            provider: "google",
            providerEventId: "calendar-week-2",
            title: "Demo",
            description: null,
            location: null,
            startAt: thursday.toISOString(),
            endAt: new Date(thursday.getTime() + 30 * 60 * 1000).toISOString(),
            isAllDay: false,
            timeZone: "America/New_York",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: thursday.toISOString(),
            updatedAt: thursday.toISOString(),
          },
        ]),
      });
    });

    await page.route("**/ideas/assistant-chat*", async (route) => {
      assistantCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify({ message: "Generic assistant fallback." }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();

    const panel = page.locator(".bulby-chatbox-panel").first();
    const input = page.getByRole("textbox", { name: "Ask Bulby" }).first();
    await expect(input).toBeVisible();
    await input.fill("what is on my calendar this week?");
    await input.press("Enter");

    await expect(panel.getByText(/Sprint planning/)).toBeVisible();
    await expect(panel.getByText(/Demo/)).toBeVisible();
    expect(assistantCalls).toBe(0);
  });

  test("answers calendar date range questions from project calendar data", async ({
    page,
  }) => {
    let assistantCalls = 0;

    await page.route("**/calendar/events**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify([
          {
            id: "calendar-range-1",
            provider: "google",
            providerEventId: "calendar-range-1",
            title: "Doctor",
            description: null,
            location: null,
            startAt: "2026-03-02T15:00:00.000Z",
            endAt: "2026-03-02T16:00:00.000Z",
            isAllDay: false,
            timeZone: "America/New_York",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z",
          },
          {
            id: "calendar-range-2",
            provider: "google",
            providerEventId: "calendar-range-2",
            title: "Therapy",
            description: null,
            location: null,
            startAt: "2026-03-10T19:00:00.000Z",
            endAt: "2026-03-10T20:00:00.000Z",
            isAllDay: false,
            timeZone: "America/New_York",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z",
          },
        ]),
      });
    });

    await page.route("**/ideas/assistant-chat*", async (route) => {
      assistantCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify({ message: "Generic assistant fallback." }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Bulby chat" }).click();

    const panel = page.locator(".bulby-chatbox-panel").first();
    const input = page.getByRole("textbox", { name: "Ask Bulby" }).first();
    await expect(input).toBeVisible();
    await input.fill("what is on my calendar between March 2 and March 10?");
    await input.press("Enter");

    await expect(panel.getByText(/Doctor/)).toBeVisible();
    await expect(panel.getByText(/Therapy/)).toBeVisible();
    expect(assistantCalls).toBe(0);
  });
});
