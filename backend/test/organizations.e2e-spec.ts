import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma.service";

describe("OrganizationsController (e2e)", () => {
  let app: INestApplication;
  let createdOrgId: string | null = null;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors();
    await app.init();
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    if (createdOrgId) {
      await prisma.organization
        .delete({ where: { id: createdOrgId } })
        .catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
  });

  it("GET /organizations returns list", () => {
    return request(app.getHttpServer())
      .get("/organizations")
      .expect(200)
      .expect((res: request.Response) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it("POST /organizations creates an organization", () => {
    const name = `Test Org ${Date.now()}`;
    return request(app.getHttpServer())
      .post("/organizations")
      .send({ name })
      .expect(201)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("id");
        expect(res.body).toHaveProperty("name", name);
        createdOrgId = res.body.id;
      });
  });
});
