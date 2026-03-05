import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TaxDocumentsService } from "./tax-documents.service";
import { PrismaService } from "../prisma.service";
import { StorageService } from "../storage.service";

describe("TaxDocumentsService", () => {
  let service: TaxDocumentsService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ organizationId: "org-1" }),
    },
    project: {
      findUnique: jest.fn().mockResolvedValue({
        id: "p1",
        organizationId: "org-1",
      }),
    },
    projectMembership: {
      findUnique: jest.fn().mockResolvedValue({ id: "pm1" }),
    },
    taxDocument: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockStorage = {
    upload: jest.fn().mockResolvedValue({ url: "uploads/taxes/x.bin" }),
    delete: jest.fn().mockResolvedValue(undefined),
    isFullUrl: jest.fn().mockReturnValue(true),
    download: jest.fn().mockResolvedValue({
      buffer: Buffer.from("x"),
      contentType: "application/octet-stream",
    }),
    resolveLocalUploadPath: jest
      .fn()
      .mockReturnValue("/tmp/uploads/taxes/x.bin"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TaxDocumentsService(
      mockPrisma as unknown as PrismaService,
      mockStorage as unknown as StorageService
    );
  });

  it("lists project documents", async () => {
    mockPrisma.taxDocument.findMany.mockResolvedValue([{ id: "d1" }]);
    const docs = await service.list("p1", "u1");
    expect(docs).toEqual([{ id: "d1" }]);
    expect(mockPrisma.taxDocument.findMany).toHaveBeenCalledWith({
      where: { projectId: "p1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("creates document and uploads file", async () => {
    mockPrisma.taxDocument.create.mockResolvedValue({ id: "d1" });
    const res = await service.create("u1", {
      projectId: "p1",
      fileName: "W2-2025.pdf",
      fileBase64: Buffer.from("abc").toString("base64"),
      kind: "w2",
      taxYear: 2025,
    });
    expect(res).toEqual({ id: "d1" });
    expect(mockStorage.upload).toHaveBeenCalled();
    expect(mockPrisma.taxDocument.create).toHaveBeenCalled();
  });

  it("rejects invalid kind", async () => {
    await expect(
      service.create("u1", {
        projectId: "p1",
        fileName: "x.pdf",
        fileBase64: Buffer.from("abc").toString("base64"),
        kind: "invalid-kind",
      })
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.taxDocument.create).not.toHaveBeenCalled();
  });

  it("rejects unsupported tax document file extension", async () => {
    await expect(
      service.create("u1", {
        projectId: "p1",
        fileName: "payload.exe",
        fileBase64: Buffer.from("abc").toString("base64"),
        kind: "other",
      })
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.taxDocument.create).not.toHaveBeenCalled();
  });

  it("updates notes/taxYear", async () => {
    mockPrisma.taxDocument.findUnique.mockResolvedValue({
      id: "d1",
      projectId: "p1",
    });
    mockPrisma.taxDocument.update.mockResolvedValue({ id: "d1", notes: "ok" });
    const res = await service.update("d1", "u1", {
      notes: "ok",
      taxYear: 2025,
    });
    expect(res).toEqual({ id: "d1", notes: "ok" });
    expect(mockPrisma.taxDocument.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { notes: "ok", taxYear: 2025 },
    });
  });

  it("removes document and stored file", async () => {
    mockPrisma.taxDocument.findUnique.mockResolvedValue({
      id: "d1",
      fileUrl: "uploads/taxes/x.bin",
      projectId: "p1",
    });
    mockPrisma.taxDocument.delete.mockResolvedValue({ id: "d1" });
    const res = await service.remove("d1", "u1");
    expect(res).toEqual({ id: "d1" });
    expect(mockStorage.delete).toHaveBeenCalledWith("uploads/taxes/x.bin");
  });

  it("throws when document not in user org", async () => {
    mockPrisma.taxDocument.findUnique.mockResolvedValue({
      id: "d1",
      fileUrl: "uploads/taxes/x.bin",
      projectId: "p1",
    });
    mockPrisma.projectMembership.findUnique.mockResolvedValueOnce(null);
    await expect(service.remove("d1", "u1")).rejects.toThrow(NotFoundException);
  });
});
