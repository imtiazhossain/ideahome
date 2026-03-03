import { TaxDocumentsController } from "./tax-documents.controller";
import { AuthenticatedRequest } from "../auth/request-user";

describe("TaxDocumentsController", () => {
  const mockSvc = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    download: jest.fn(),
  };

  const req = { user: { sub: "u1" } } as AuthenticatedRequest;

  let controller: TaxDocumentsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TaxDocumentsController(mockSvc as any);
  });

  it("lists docs", async () => {
    mockSvc.list.mockResolvedValue([{ id: "d1" }]);
    await expect(controller.list("p1", req)).resolves.toEqual([{ id: "d1" }]);
    expect(mockSvc.list).toHaveBeenCalledWith("p1", "u1");
  });

  it("creates doc", async () => {
    const body = { projectId: "p1", fileName: "x.pdf", fileBase64: "abc" };
    mockSvc.create.mockResolvedValue({ id: "d1" });
    await expect(controller.create(body, req)).resolves.toEqual({ id: "d1" });
    expect(mockSvc.create).toHaveBeenCalledWith("u1", body);
  });

  it("updates doc", async () => {
    const body = { notes: "updated" };
    mockSvc.update.mockResolvedValue({ id: "d1", notes: "updated" });
    await expect(controller.update("d1", body, req)).resolves.toEqual({
      id: "d1",
      notes: "updated",
    });
    expect(mockSvc.update).toHaveBeenCalledWith("d1", "u1", body);
  });

  it("removes doc", async () => {
    mockSvc.remove.mockResolvedValue({ id: "d1" });
    await expect(controller.remove("d1", req)).resolves.toEqual({ id: "d1" });
    expect(mockSvc.remove).toHaveBeenCalledWith("d1", "u1");
  });
});
