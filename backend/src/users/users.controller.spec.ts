import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

describe("UsersController", () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    list: jest.fn(),
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
});
