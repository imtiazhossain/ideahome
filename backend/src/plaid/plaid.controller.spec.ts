import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PlaidController } from "./plaid.controller";
import { PlaidService } from "./plaid.service";

describe("PlaidController", () => {
  let controller: PlaidController;

  const mockPlaid = {
    createLinkToken: jest.fn(),
    exchangePublicToken: jest.fn(),
    listLinkedAccounts: jest.fn(),
    renameLinkedAccount: jest.fn(),
    removeLinkedAccount: jest.fn(),
    syncTransactions: jest.fn(),
    getLastSync: jest.fn(),
  };

  const req = { user: { sub: "user1" } } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlaidController],
      providers: [{ provide: PlaidService, useValue: mockPlaid }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PlaidController>(PlaidController);
  });

  it("createLinkToken delegates to service", async () => {
    mockPlaid.createLinkToken.mockResolvedValue({ linkToken: "lt_xxx" });
    const result = await controller.createLinkToken(req);
    expect(result).toEqual({ linkToken: "lt_xxx" });
    expect(mockPlaid.createLinkToken).toHaveBeenCalledWith("user1");
  });

  it("exchange delegates with body.public_token or empty string", async () => {
    mockPlaid.exchangePublicToken.mockResolvedValue({
      itemId: "i1",
      institutionName: "Bank",
    });
    await controller.exchange({ public_token: "pt_xxx" }, req);
    expect(mockPlaid.exchangePublicToken).toHaveBeenCalledWith("user1", "pt_xxx");
    await controller.exchange({}, req);
    expect(mockPlaid.exchangePublicToken).toHaveBeenCalledWith("user1", "");
  });

  it("listLinkedAccounts delegates to service", async () => {
    mockPlaid.listLinkedAccounts.mockResolvedValue([{ id: "pi1" }]);
    const result = await controller.listLinkedAccounts(req);
    expect(result).toEqual([{ id: "pi1" }]);
    expect(mockPlaid.listLinkedAccounts).toHaveBeenCalledWith("user1");
  });

  it("renameLinkedAccount validates id and body", async () => {
    mockPlaid.renameLinkedAccount.mockResolvedValue({});
    await controller.renameLinkedAccount("id1", { institutionName: "New Name" }, req);
    expect(mockPlaid.renameLinkedAccount).toHaveBeenCalledWith(
      "user1",
      "id1",
      "New Name"
    );
    await controller.renameLinkedAccount("id2", { institutionName: null }, req);
    expect(mockPlaid.renameLinkedAccount).toHaveBeenCalledWith("user1", "id2", null);
  });

  it("renameLinkedAccount throws when id empty", () => {
    expect(() =>
      controller.renameLinkedAccount("  ", { institutionName: "x" }, req)
    ).toThrow("id is required");
    expect(() =>
      controller.renameLinkedAccount("" as any, {}, req)
    ).toThrow("id is required");
  });

  it("renameLinkedAccount throws when institutionName not string or null", () => {
    expect(() =>
      controller.renameLinkedAccount("id", { institutionName: 123 } as any, req)
    ).toThrow("institutionName must be a string or null");
  });

  it("removeLinkedAccount delegates and throws when id empty", async () => {
    mockPlaid.removeLinkedAccount.mockResolvedValue(undefined);
    await controller.removeLinkedAccount("id1", req);
    expect(mockPlaid.removeLinkedAccount).toHaveBeenCalledWith("user1", "id1");
    expect(() => controller.removeLinkedAccount("  ", req)).toThrow(
      "id is required"
    );
  });

  it("sync validates projectId", async () => {
    mockPlaid.syncTransactions.mockResolvedValue({});
    await controller.sync("proj1", req);
    expect(mockPlaid.syncTransactions).toHaveBeenCalledWith("user1", "proj1");
    expect(() => controller.sync("  ", req)).toThrow(
      "projectId is required"
    );
  });

  it("getLastSync validates projectId", async () => {
    mockPlaid.getLastSync.mockResolvedValue(null);
    await controller.getLastSync("proj1", req);
    expect(mockPlaid.getLastSync).toHaveBeenCalledWith("user1", "proj1");
    expect(() => controller.getLastSync("  ", req)).toThrow(
      "projectId is required"
    );
  });
});
