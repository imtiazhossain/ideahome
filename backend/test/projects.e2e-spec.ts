import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma.service";

describe("ProjectsController (e2e)", () => {
  let app: INestApplication;
  let orgId: string;
  let projectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors();
    await app.init();

    const orgRes = await request(app.getHttpServer())
      .post("/organizations")
      .send({ name: `E2E Org ${Date.now()}` });
    orgId = orgRes.body.id;
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    if (orgId) {
      await prisma.project
        .deleteMany({ where: { organizationId: orgId } })
        .catch(() => {});
      await prisma.organization
        .delete({ where: { id: orgId } })
        .catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
  });

  it("GET /projects returns list", () => {
    return request(app.getHttpServer())
      .get("/projects")
      .expect(200)
      .expect((res: request.Response) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it("GET /projects?orgId= returns list filtered by org", () => {
    return request(app.getHttpServer())
      .get("/projects")
      .query({ orgId })
      .expect(200)
      .expect((res: request.Response) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it("POST /projects creates a project", () => {
    const name = `E2E Project ${Date.now()}`;
    return request(app.getHttpServer())
      .post("/projects")
      .send({ name, organizationId: orgId })
      .expect(201)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("id");
        expect(res.body).toHaveProperty("name", name);
        expect(res.body).toHaveProperty("organizationId", orgId);
        projectId = res.body.id;
      });
  });

  it("GET /projects/:id returns a project", () => {
    return request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("id", projectId);
      });
  });

  it("PUT /projects/:id updates", () => {
    const newName = `Updated E2E ${Date.now()}`;
    return request(app.getHttpServer())
      .put(`/projects/${projectId}`)
      .send({ name: newName })
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("name", newName);
      });
  });

  it("DELETE /projects/:id deletes project and its issues", () => {
    return request(app.getHttpServer())
      .delete(`/projects/${projectId}`)
      .expect(200);
  });

  it("GET /projects/:id after delete returns 404", () => {
    return request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .expect(404);
  });
});
