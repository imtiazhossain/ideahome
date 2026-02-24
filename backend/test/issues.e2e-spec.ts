import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma.service";
import { createTestUserWithOrg } from "./helpers";

describe("IssuesController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let orgId: string;
  let projectId: string;
  let issueId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors();
    await app.init();

    prisma = app.get(PrismaService);
    const testUser = await createTestUserWithOrg(prisma);
    token = testUser.token;
    userId = testUser.userId;
    orgId = testUser.orgId;

    const projectRes = await request(app.getHttpServer())
      .post("/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `E2E Issues Project ${Date.now()}` });
    projectId = projectRes.body.id;
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.issue.deleteMany({ where: { projectId } }).catch(() => {});
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    if (orgId) {
      await prisma.organization
        .delete({ where: { id: orgId } })
        .catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
  });

  const auth = (req: request.Test) =>
    req.set("Authorization", `Bearer ${token}`);

  it("GET /issues returns list", () => {
    return auth(request(app.getHttpServer()).get("/issues"))
      .expect(200)
      .expect((res: request.Response) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it("GET /issues?projectId= returns list filtered by project", () => {
    return auth(
      request(app.getHttpServer()).get("/issues").query({ projectId })
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it("POST /issues creates an issue", () => {
    const title = `E2E Issue ${Date.now()}`;
    return auth(
      request(app.getHttpServer()).post("/issues").send({
        title,
        description: "E2E description",
        projectId,
      })
    )
      .expect(201)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("id");
        expect(res.body).toHaveProperty("title", title);
        expect(res.body).toHaveProperty("projectId", projectId);
        expect(res.body).toHaveProperty("status", "backlog");
        issueId = res.body.id;
      });
  });

  it("GET /issues/:id returns an issue", () => {
    return auth(request(app.getHttpServer()).get(`/issues/${issueId}`))
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("id", issueId);
        expect(res.body).toHaveProperty("project");
      });
  });

  it("PUT /issues/:id updates", () => {
    return auth(
      request(app.getHttpServer())
        .put(`/issues/${issueId}`)
        .send({ title: "Updated", status: "in_progress" })
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("title", "Updated");
        expect(res.body).toHaveProperty("status", "in_progress");
      });
  });

  it("PUT /issues/:id persists automatedTest as JSON array", async () => {
    const tests = JSON.stringify([
      "home page loads with title and app bar",
      "sidebar shows Team Deck",
    ]);
    const res = await auth(
      request(app.getHttpServer())
        .put(`/issues/${issueId}`)
        .send({ automatedTest: tests })
    ).expect(200);

    expect(res.body).toHaveProperty("automatedTest", tests);

    const getRes = await auth(
      request(app.getHttpServer()).get(`/issues/${issueId}`)
    ).expect(200);

    expect(getRes.body).toHaveProperty("automatedTest", tests);
  });

  it("POST /issues creates an issue with automatedTest", async () => {
    const tests = JSON.stringify(["opens create project modal and shows form"]);
    const res = await auth(
      request(app.getHttpServer())
        .post("/issues")
        .send({
          title: `E2E Automated Test Issue ${Date.now()}`,
          projectId,
          automatedTest: tests,
        })
    ).expect(201);

    expect(res.body).toHaveProperty("automatedTest", tests);
    await auth(
      request(app.getHttpServer()).delete(`/issues/${res.body.id}`)
    ).expect(200);
  });

  it("PUT /issues/:id with token also updates", () => {
    const newTitle = `Updated E2E Issue ${Date.now()}`;
    return auth(
      request(app.getHttpServer())
        .put(`/issues/${issueId}`)
        .send({ title: newTitle, status: "done" })
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("title", newTitle);
        expect(res.body).toHaveProperty("status", "done");
      });
  });

  it("PATCH /issues/:id/status persists status (for lane moves)", () => {
    return auth(
      request(app.getHttpServer())
        .patch(`/issues/${issueId}/status`)
        .set("Content-Type", "application/json")
        .send({ status: "in_progress" })
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("status", "in_progress");
        expect(res.body).toHaveProperty("id", issueId);
      });
  });

  it("POST /issues/:id/comments and DELETE /issues/:id/comments/:commentId", async () => {
    const createRes = await auth(
      request(app.getHttpServer())
        .post(`/issues/${issueId}/comments`)
        .set("Content-Type", "application/json")
        .send({ body: "E2E comment to delete" })
    ).expect(201);
    const commentId = createRes.body.id;
    expect(commentId).toBeDefined();

    const listRes = await auth(
      request(app.getHttpServer()).get(`/issues/${issueId}/comments`)
    ).expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.some((c: { id: string }) => c.id === commentId)).toBe(
      true
    );

    await auth(
      request(app.getHttpServer()).delete(
        `/issues/${issueId}/comments/${commentId}`
      )
    ).expect(200);

    const listAfter = await auth(
      request(app.getHttpServer()).get(`/issues/${issueId}/comments`)
    ).expect(200);
    expect(listAfter.body.some((c: { id: string }) => c.id === commentId)).toBe(
      false
    );
  });

  it("DELETE /issues/:id deletes", () => {
    return auth(
      request(app.getHttpServer()).delete(`/issues/${issueId}`)
    ).expect(200);
  });

  it("GET /issues/:id after delete returns 404", () => {
    return auth(request(app.getHttpServer()).get(`/issues/${issueId}`)).expect(
      404
    );
  });

  it("DELETE /issues/bulk?projectId= deletes all issues in project", async () => {
    const create1 = await auth(
      request(app.getHttpServer())
        .post("/issues")
        .send({ title: "Bulk delete 1", projectId })
    ).expect(201);
    const create2 = await auth(
      request(app.getHttpServer())
        .post("/issues")
        .send({ title: "Bulk delete 2", projectId })
    ).expect(201);
    await auth(
      request(app.getHttpServer()).delete("/issues/bulk").query({ projectId })
    ).expect(200);
    const list = await auth(
      request(app.getHttpServer()).get("/issues").query({ projectId })
    ).expect(200);
    expect(list.body).toHaveLength(0);
  });
});
