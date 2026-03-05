import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

describe("UsersController", () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    list: jest.fn(),
    getAppearancePreferences: jest.fn(),
    updateAppearancePreferences: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("list", () => {
    it("should return result from service.list()", async () => {
      const users = [
        { id: "1", email: "a@test.com", name: "User A" },
        { id: "2", email: "b@test.com", name: null },
      ];
      mockUsersService.list.mockResolvedValue(users);
      const req = { user: { sub: "u1" } } as any;

      await expect(controller.list(req)).resolves.toEqual(users);
      expect(mockUsersService.list).toHaveBeenCalledTimes(1);
      expect(mockUsersService.list).toHaveBeenCalledWith("u1");
    });
  });

  describe("appearance", () => {
    it("returns effective appearance preferences", async () => {
      const req = { user: { sub: "u1" } } as any;
      const prefs = {
        version: 1,
        lightPreset: "classic",
        darkPreset: "forest",
        updatedAt: "2026-03-05T00:00:00.000Z",
      };
      mockUsersService.getAppearancePreferences.mockResolvedValue(prefs);

      await expect(controller.getAppearance(req)).resolves.toEqual(prefs);
      expect(mockUsersService.getAppearancePreferences).toHaveBeenCalledWith(
        "u1"
      );
    });

    it("updates appearance preferences", async () => {
      const req = { user: { sub: "u1" } } as any;
      const body = { lightPreset: "ocean", darkPreset: "forest" };
      const saved = {
        version: 1,
        lightPreset: "ocean",
        darkPreset: "forest",
        updatedAt: "2026-03-05T00:00:00.000Z",
      };
      mockUsersService.updateAppearancePreferences.mockResolvedValue(saved);

      await expect(controller.updateAppearance(req, body)).resolves.toEqual(
        saved
      );
      expect(mockUsersService.updateAppearancePreferences).toHaveBeenCalledWith(
        "u1",
        body
      );
    });
  });
});
