import { test, expect } from "@playwright/test";
import {
  ensureProjectExists,
  expandSidebarIfNeeded,
} from "./helpers";

type MockUser = { id: string; email: string; name: string | null };
type MockProjectMember = {
  userId: string;
  role: string;
  createdAt: string;
  user: MockUser;
};
type MockProjectInvite = {
  id: string;
  email: string;
  createdAt: string;
  invitedByUserId: string | null;
};

test.beforeAll(async () => {
  await ensureProjectExists();
});

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("Project settings invites", () => {
  test("Send and Add trigger only their own endpoint", async ({ page }) => {
    const nowIso = new Date().toISOString();
    const projects = [{ id: "project-e2e", name: "E2E Mock Project" }];
    const users: MockUser[] = [
      { id: "user-owner", email: "owner@example.com", name: "Owner" },
      { id: "user-inviteable", email: "teammate@example.com", name: "Teammate" },
    ];
    const userById = new Map(users.map((user) => [user.id, user]));
    let members: MockProjectMember[] = [
      {
        userId: "user-owner",
        role: "OWNER",
        createdAt: nowIso,
        user: users[0],
      },
    ];
    let invites: MockProjectInvite[] = [];

    let invitePostCount = 0;
    let memberPostCount = 0;
    const invitePostBodies: Array<{ email?: string }> = [];
    const memberPostBodies: Array<{ userId?: string }> = [];

    await page.route("**/*", async (route) => {
      const request = route.request();
      const method = request.method();
      const pathname = new URL(request.url()).pathname;

      if (method === "GET" && pathname === "/projects") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(projects),
        });
        return;
      }

      if (method === "GET" && pathname === "/users") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(users),
        });
        return;
      }

      const membersPathMatch = pathname.match(/^\/projects\/([^/]+)\/members$/);
      if (membersPathMatch) {
        if (method === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(members),
          });
          return;
        }
        if (method === "POST") {
          memberPostCount += 1;
          const body = (request.postDataJSON() as { userId?: string } | null) ?? {};
          memberPostBodies.push(body);
          const inviteeId = body.userId?.trim();
          if (inviteeId && userById.has(inviteeId)) {
            const alreadyMember = members.some((m) => m.userId === inviteeId);
            if (!alreadyMember) {
              members = [
                ...members,
                {
                  userId: inviteeId,
                  role: "MEMBER",
                  createdAt: nowIso,
                  user: userById.get(inviteeId)!,
                },
              ];
            }
          }
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(members),
          });
          return;
        }
      }

      const invitesPathMatch = pathname.match(/^\/projects\/([^/]+)\/invites$/);
      if (invitesPathMatch) {
        if (method === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(invites),
          });
          return;
        }
        if (method === "POST") {
          invitePostCount += 1;
          const body = (request.postDataJSON() as { email?: string } | null) ?? {};
          invitePostBodies.push(body);
          const email = body.email?.trim();
          if (email) {
            invites = [
              ...invites,
              {
                id: `invite-${invites.length + 1}`,
                email,
                createdAt: nowIso,
                invitedByUserId: "user-owner",
              },
            ];
          }
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(invites),
          });
          return;
        }
      }

      await route.continue();
    });

    await test.step("Open project settings modal", async () => {
      await page.addInitScript(() => {
        localStorage.setItem("ideahome_token", "e2e-token");
        sessionStorage.setItem("ideahome_token_session", "e2e-token");
        document.cookie = "ideahome_token=e2e-token; path=/";
      });
      await page.goto("/");
      await expandSidebarIfNeeded(page);
      const projectButton = page.getByRole("button", {
        name: "E2E Mock Project",
        exact: true,
      });
      await expect(projectButton).toBeVisible({ timeout: 10000 });
      await projectButton.click();

      const openSettingsButton = page.getByRole("button", {
        name: "Open project settings",
      });
      await expect(openSettingsButton).toBeVisible();
      await openSettingsButton.click();
      await expect(
        page.locator(".modal h2").filter({ hasText: "Project settings" })
      ).toBeVisible({ timeout: 10000 });
    });

    await test.step("Click Send and verify only invites POST is called", async () => {
      await page.getByPlaceholder("Invite by email").fill("invitee@example.com");
      await page
        .locator(".project-settings-modal-invite-row")
        .first()
        .getByRole("button", { name: "Send" })
        .click();

      await expect.poll(() => invitePostCount).toBe(1);
      await expect.poll(() => memberPostCount).toBe(0);
      await expect.poll(() => invitePostBodies[0]?.email).toBe(
        "invitee@example.com"
      );
    });

    await test.step("Click Add and verify only members POST is called", async () => {
      const memberSelect = page
        .locator(".project-settings-modal-user-select")
        .first();
      await expect(memberSelect).toBeVisible();
      await memberSelect.selectOption("user-inviteable");

      await page
        .locator(".project-settings-modal-invite-row")
        .nth(1)
        .getByRole("button", { name: "Add" })
        .click();

      await expect.poll(() => memberPostCount).toBe(1);
      await expect.poll(() => invitePostCount).toBe(1);
      await expect.poll(() => memberPostBodies[0]?.userId).toBe(
        "user-inviteable"
      );
    });
  });
});
