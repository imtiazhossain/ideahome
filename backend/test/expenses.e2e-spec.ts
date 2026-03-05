import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma.service";
import { createTestUserWithOrg } from "./helpers";

describe("ExpensesController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let orgId: string;
  let projectId: string;
  let expenseId: string;

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
      .send({ name: `E2E Expenses Project ${Date.now()}` })
      .expect(201);
    projectId = projectRes.body.id;
  });

  afterAll(async () => {
    if (expenseId) {
      await prisma.expense.delete({ where: { id: expenseId } }).catch(() => {});
    }
    if (projectId) {
      await prisma.expense
        .deleteMany({ where: { projectId } })
        .catch(() => {});
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    if (userId) {
      await prisma.project
        .deleteMany({ where: { organizationId: orgId } })
        .catch(() => {});
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

  it("GET /expenses returns empty list when no expenses", () => {
    return auth(
      request(app.getHttpServer()).get("/expenses").query({ projectId })
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(0);
      });
  });

  it("POST /expenses creates an expense", () => {
    return auth(
      request(app.getHttpServer())
        .post("/expenses")
        .send({
          projectId,
          amount: 42.5,
          description: "E2E test expense",
          date: "2026-03-01",
          category: "Other",
        })
    )
      .expect(201)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("id");
        expect(res.body).toHaveProperty("projectId", projectId);
        expect(res.body).toHaveProperty("amount", 42.5);
        expect(res.body).toHaveProperty("description", "E2E test expense");
        expect(res.body).toHaveProperty("date", "2026-03-01");
        expect(res.body).toHaveProperty("category", "Other");
        expenseId = res.body.id;
      });
  });

  it("GET /expenses returns the created expense", () => {
    return auth(
      request(app.getHttpServer()).get("/expenses").query({ projectId })
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toHaveProperty("id", expenseId);
        expect(res.body[0]).toHaveProperty("amount", 42.5);
      });
  });

  it("PATCH /expenses/:id updates the expense", () => {
    return auth(
      request(app.getHttpServer())
        .patch(`/expenses/${expenseId}`)
        .send({ amount: 99, description: "Updated E2E expense" })
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("amount", 99);
        expect(res.body).toHaveProperty("description", "Updated E2E expense");
      });
  });

  it("DELETE /expenses/:id removes the expense", () => {
    return auth(
      request(app.getHttpServer()).delete(`/expenses/${expenseId}`)
    ).expect(200);
  });

  it("GET /expenses returns empty list after delete", () => {
    return auth(
      request(app.getHttpServer()).get("/expenses").query({ projectId })
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveLength(0);
      });
  });
});
