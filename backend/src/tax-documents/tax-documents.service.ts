import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Response } from "express";
import { createReadStream, existsSync } from "fs";
import { verifyProjectForUser } from "../common/org-scope";
import { PrismaService } from "../prisma.service";
import { StorageService } from "../storage.service";

const ALLOWED_KINDS = new Set([
  "w2",
  "1099",
  "1098",
  "deduction",
  "identity",
  "prior_return",
  "property",
  "medical",
  "retirement",
  "crypto",
  "business",
  "payment",
  "other",
]);
const ALLOWED_TAX_FILE_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "tif",
  "tiff",
  "heic",
  "heif",
  "csv",
  "txt",
]);

@Injectable()
export class TaxDocumentsService {
  private static readonly LOCAL_TAX_URL_RE =
    /^uploads\/taxes\/[a-zA-Z0-9_.-]+$/;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  private normalizeProjectId(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return value.trim();
  }

  private normalizeFileName(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException("fileName is required");
    }
    const trimmed = value.trim();
    if (trimmed.length > 255) {
      throw new BadRequestException("fileName must be 255 characters or fewer");
    }
    return trimmed;
  }

  private normalizeBase64(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException("fileBase64 is required");
    }
    return value.trim();
  }

  private decodeBase64(value: string): Buffer {
    try {
      const normalized = this.stripDataUrlPrefix(value).replace(/\s+/g, "");
      if (
        normalized.length === 0 ||
        normalized.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
      ) {
        throw new BadRequestException("fileBase64 is invalid");
      }
      const buffer = Buffer.from(normalized, "base64");
      if (!buffer.length) {
        throw new BadRequestException("fileBase64 is invalid");
      }
      return buffer;
    } catch {
      throw new BadRequestException("fileBase64 is invalid");
    }
  }

  private stripDataUrlPrefix(value: string): string {
    const trimmed = value.trim();
    if (!trimmed.toLowerCase().startsWith("data:")) return trimmed;
    const commaIdx = trimmed.indexOf(",");
    return commaIdx >= 0 ? trimmed.slice(commaIdx + 1) : trimmed;
  }

  private extensionFromName(fileName: string): string {
    const match = fileName.toLowerCase().match(/\.([a-z0-9]{1,16})$/);
    return match?.[1] ?? "";
  }

  private taxContentTypeFromExtension(ext: string): string {
    if (ext === "pdf") return "application/pdf";
    if (ext === "png") return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "webp") return "image/webp";
    if (ext === "csv") return "text/csv; charset=utf-8";
    if (ext === "txt") return "text/plain; charset=utf-8";
    if (ext === "tif" || ext === "tiff") return "image/tiff";
    if (ext === "heic" || ext === "heif") return "image/heic";
    return "application/octet-stream";
  }

  private applySecureDownloadHeaders(res: Response): void {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  }

  private normalizeKind(value: unknown): string {
    if (value === undefined || value === null) return "other";
    if (typeof value !== "string") {
      throw new BadRequestException("kind must be a string");
    }
    const safe = value.trim().toLowerCase();
    if (!safe) return "other";
    if (!ALLOWED_KINDS.has(safe)) {
      throw new BadRequestException("kind is invalid");
    }
    return safe;
  }

  private normalizeTaxYear(value: unknown): number | null {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new BadRequestException("taxYear must be an integer");
    }
    if (parsed < 2000 || parsed > 2100) {
      throw new BadRequestException("taxYear must be between 2000 and 2100");
    }
    return parsed;
  }

  private normalizeOptionalText(
    value: unknown,
    field: "notes" | "textPreview",
    maxLen: number
  ): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") {
      throw new BadRequestException(`${field} must be a string`);
    }
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLen);
  }

  private async verifyProjectAccess(
    projectId: string,
    userId: string
  ): Promise<void> {
    await verifyProjectForUser(this.prisma, projectId, userId);
  }

  private async getByIdAndUser(id: string, userId: string) {
    const doc = await this.prisma.taxDocument.findUnique({
      where: { id },
      select: { id: true, fileUrl: true, fileName: true, projectId: true },
    });
    if (!doc) {
      throw new NotFoundException("Tax document not found");
    }
    await this.verifyProjectAccess(doc.projectId, userId);
    return doc;
  }

  async list(projectId: string, userId: string) {
    const safeProjectId = this.normalizeProjectId(projectId);
    await this.verifyProjectAccess(safeProjectId, userId);
    return this.prisma.taxDocument.findMany({
      where: { projectId: safeProjectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    userId: string,
    body: {
      projectId?: unknown;
      fileName?: unknown;
      fileBase64?: unknown;
      kind?: unknown;
      taxYear?: unknown;
      notes?: unknown;
      textPreview?: unknown;
    }
  ) {
    const projectId = this.normalizeProjectId(body.projectId);
    await this.verifyProjectAccess(projectId, userId);
    const fileName = this.normalizeFileName(body.fileName);
    const buffer = this.decodeBase64(this.normalizeBase64(body.fileBase64));
    if (buffer.byteLength > 25 * 1024 * 1024) {
      throw new BadRequestException("File too large (max 25MB)");
    }

    const ext = this.extensionFromName(fileName);
    if (!ext || !ALLOWED_TAX_FILE_EXTENSIONS.has(ext)) {
      throw new BadRequestException(
        "Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, TIFF, HEIC, CSV, TXT"
      );
    }
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "bin";
    const filename = `${projectId}-${Date.now()}-${safeExt}`;
    const contentType = this.taxContentTypeFromExtension(ext);
    const { url: fileUrl } = await this.storage.upload(
      "taxes",
      filename,
      buffer,
      contentType
    );

    return this.prisma.taxDocument.create({
      data: {
        projectId,
        fileUrl,
        fileName,
        sizeBytes: buffer.byteLength,
        kind: this.normalizeKind(body.kind),
        taxYear: this.normalizeTaxYear(body.taxYear),
        notes: this.normalizeOptionalText(body.notes, "notes", 2000),
        textPreview: this.normalizeOptionalText(
          body.textPreview,
          "textPreview",
          1000
        ),
      },
    });
  }

  async update(
    id: string,
    userId: string,
    body: {
      kind?: unknown;
      taxYear?: unknown;
      notes?: unknown;
      textPreview?: unknown;
    }
  ) {
    await this.getByIdAndUser(id, userId);
    const data: {
      kind?: string;
      taxYear?: number | null;
      notes?: string | null;
      textPreview?: string | null;
    } = {};
    if (body.kind !== undefined) data.kind = this.normalizeKind(body.kind);
    if (body.taxYear !== undefined) {
      data.taxYear = this.normalizeTaxYear(body.taxYear);
    }
    if (body.notes !== undefined) {
      data.notes = this.normalizeOptionalText(body.notes, "notes", 2000);
    }
    if (body.textPreview !== undefined) {
      data.textPreview = this.normalizeOptionalText(
        body.textPreview,
        "textPreview",
        1000
      );
    }
    if (Object.keys(data).length === 0) {
      return this.prisma.taxDocument.findUnique({ where: { id } });
    }
    return this.prisma.taxDocument.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    const doc = await this.getByIdAndUser(id, userId);
    await this.storage.delete(doc.fileUrl);
    return this.prisma.taxDocument.delete({ where: { id } });
  }

  async download(id: string, userId: string, res: Response): Promise<void> {
    const doc = await this.getByIdAndUser(id, userId);
    if (this.storage.isFullUrl(doc.fileUrl)) {
      const { buffer, contentType } = await this.storage.download(doc.fileUrl);
      res.setHeader("Content-Type", contentType ?? "application/octet-stream");
      this.applySecureDownloadHeaders(res);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(doc.fileName)}"`
      );
      res.send(buffer);
      return;
    }
    if (!TaxDocumentsService.LOCAL_TAX_URL_RE.test(doc.fileUrl)) {
      throw new NotFoundException("Tax document not found");
    }
    const filename = doc.fileUrl.split("/").pop();
    if (!filename) throw new NotFoundException("Tax document not found");
    const filePath = this.storage.resolveLocalUploadPath("taxes", filename);
    if (!existsSync(filePath))
      throw new NotFoundException("Tax document not found");
    const ext = this.extensionFromName(doc.fileName);
    res.setHeader("Content-Type", this.taxContentTypeFromExtension(ext));
    this.applySecureDownloadHeaders(res);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(doc.fileName)}"`
    );
    const stream = createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.status(500).end();
        return;
      }
      res.end();
    });
    stream.pipe(res);
  }
}
