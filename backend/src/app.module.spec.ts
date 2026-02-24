import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma.service";

describe("AppModule", () => {
  it("should compile with all imports", async () => {
    const mockPrisma = {
      user: { findMany: jest.fn(), upsert: jest.fn() },
      issue: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      project: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      organization: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $connect: jest.fn(),
      onModuleInit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    expect(module).toBeDefined();
  });
});
