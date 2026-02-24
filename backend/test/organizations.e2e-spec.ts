import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma.service";
import { createTestUserWithOrg } from "./helpers";

describe("OrganizationsController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let orgId: string;
  let createdOrgId: string | null = null;

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
    if (createdOrgId) {
      await prisma.organization
        .delete({ where: { id: createdOrgId } })
        .catch(() => {});
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

  it("GET /organizations returns list (user's org only)", () => {
    return auth(request(app.getHttpServer()).get("/organizations"))
      .expect(200)
      .expect((res: request.Response) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
        expect(res.body[0]).toHaveProperty("id", orgId);
      });
  });

  it("POST /organizations creates an organization", () => {
    const name = `Test Org ${Date.now()}`;
    return auth(
      request(app.getHttpServer()).post("/organizations").send({ name })
    )
      .expect(201)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty("id");
        expect(res.body).toHaveProperty("name", name);
        createdOrgId = res.body.id;
      });
  });
});
