import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma.service";
import { createTestUserWithOrg } from "./helpers";

describe("TodosController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let orgId: string;
  let projectId: string;
  let todoId: string;

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
    const project = await prisma.project.create({
      data: { name: `E2E Todos Project ${Date.now()}`, organizationId: orgId },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.todo.deleteMany({ where: { projectId } }).catch(() => {});
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

  it("GET /todos?projectId= returns list", () => {
    return auth(
      request(app.getHttpServer()).get(`/todos?projectId=${projectId}`)
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(0);
      });
  });

  it("POST /todos creates a todo", () => {
    return auth(request(app.getHttpServer()).post("/todos").send({
      projectId,
      name: "E2E todo item",
      done: false,
    }))
      .expect(201)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("id");
        expect(res.body).toHaveProperty("name", "E2E todo item");
        expect(res.body).toHaveProperty("done", false);
        expect(res.body).toHaveProperty("projectId", projectId);
        todoId = res.body.id;
      });
  });

  it("GET /todos?projectId= returns the created todo", () => {
    return auth(
      request(app.getHttpServer()).get(`/todos?projectId=${projectId}`)
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toHaveProperty("id", todoId);
      });
  });

  it("PATCH /todos/:id updates todo", () => {
    return auth(
      request(app.getHttpServer()).patch(`/todos/${todoId}`).send({
        name: "Updated E2E todo",
        done: true,
      })
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("name", "Updated E2E todo");
        expect(res.body).toHaveProperty("done", true);
      });
  });

  it("POST /todos/reorder reorders", () => {
    return auth(request(app.getHttpServer()).post("/todos/reorder").send({
      projectId,
      todoIds: [todoId],
    }))
      .expect(201)
      .expect((res: request.Response) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(1);
      });
  });

  it("DELETE /todos/:id removes todo", () => {
    return auth(request(app.getHttpServer()).delete(`/todos/${todoId}`)).expect(
      200
    );
  });

  it("GET /todos?projectId= after delete returns empty", () => {
    return auth(
      request(app.getHttpServer()).get(`/todos?projectId=${projectId}`)
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveLength(0);
      });
  });
});
