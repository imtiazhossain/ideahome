import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma.service";
import { createTestUserWithOrg } from "./helpers";

describe("ProjectsController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let orgId: string;
  let projectId: string;

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
  });

  afterAll(async () => {
    if (projectId) {
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

  it("GET /projects returns list (user-scoped)", () => {
    return auth(request(app.getHttpServer()).get("/projects"))
      .expect(200)
      .expect((res: request.Response) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it("POST /projects creates a project in user's org", () => {
    const name = `E2E Project ${Date.now()}`;
    return auth(request(app.getHttpServer()).post("/projects").send({ name }))
      .expect(201)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("id");
        expect(res.body).toHaveProperty("name", name);
        expect(res.body).toHaveProperty("organizationId", orgId);
        projectId = res.body.id;
      });
  });

  it("GET /projects/:id returns a project", () => {
    return auth(request(app.getHttpServer()).get(`/projects/${projectId}`))
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("id", projectId);
      });
  });

  it("PUT /projects/:id updates", () => {
    const newName = `Updated E2E ${Date.now()}`;
    return auth(
      request(app.getHttpServer())
        .put(`/projects/${projectId}`)
        .send({ name: newName })
    )
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("name", newName);
      });
  });

  it("DELETE /projects/:id deletes project and its issues", () => {
    return auth(
      request(app.getHttpServer()).delete(`/projects/${projectId}`)
    ).expect(200);
  });

  it("GET /projects/:id after delete returns 404", () => {
    return auth(
      request(app.getHttpServer()).get(`/projects/${projectId}`)
    ).expect(404);
  });
});
