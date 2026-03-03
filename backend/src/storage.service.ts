import { BadRequestException, Injectable, Optional } from "@nestjs/common";
import { tmpdir } from "os";
import { join } from "path";
import { MalwareScannerService } from "./malware-scanner.service";

export interface StorageResult {
  url: string;
}

/**
 * Abstraction for file storage. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
 * otherwise uses local filesystem (for local dev).
 */
@Injectable()
export class StorageService {
  private static readonly LOCAL_UPLOAD_PATH_RE =
    /^uploads\/(recordings|screenshots|files|taxes)\/[a-zA-Z0-9_.-]+$/;
  private static readonly LOCAL_UPLOAD_PATH_PARTS_RE =
    /^uploads\/(recordings|screenshots|files|taxes)\/([a-zA-Z0-9_.-]+)$/;
  private static readonly SAFE_FILENAME_RE = /^[a-zA-Z0-9_.-]+$/;

  constructor(
    @Optional() private readonly malwareScanner?: MalwareScannerService
  ) {}

  private useBlob(): boolean {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  }

  private validateFilename(filename: string): void {
    if (
      !filename ||
      filename.length > 180 ||
      !StorageService.SAFE_FILENAME_RE.test(filename)
    ) {
      throw new BadRequestException("Unsafe filename");
    }
  }

  async upload(
    folder: "recordings" | "screenshots" | "files" | "taxes",
    filename: string,
    buffer: Buffer,
    contentType?: string
  ): Promise<StorageResult> {
    this.validateFilename(filename);
    if (this.malwareScanner) {
      await this.malwareScanner.scanOrThrow(buffer, { folder, filename });
    }
    if (this.useBlob()) {
      return this.uploadToBlob(folder, filename, buffer, contentType);
    }
    return this.uploadToFilesystem(folder, filename, buffer);
  }

  async delete(urlOrPath: string): Promise<void> {
    if (this.isFullUrl(urlOrPath)) {
      await this.deleteFromBlob(urlOrPath);
    } else {
      await this.deleteFromFilesystem(urlOrPath);
    }
  }

  /** Returns true if the URL is a full URL (Blob) that can be used directly. */
  isFullUrl(urlOrPath: string): boolean {
    return /^https?:\/\//i.test(urlOrPath);
  }

  /** Absolute filesystem path for a local upload file name. */
  resolveLocalUploadPath(
    folder: "recordings" | "screenshots" | "files" | "taxes",
    filename: string
  ): string {
    this.validateFilename(filename);
    return join(this.localUploadsRoot(), folder, filename);
  }

  private async uploadToBlob(
    folder: string,
    filename: string,
    buffer: Buffer,
    contentType?: string
  ): Promise<StorageResult> {
    const { put } = await import("@vercel/blob");
    const pathname = `${folder}/${filename}`;
    const result = await put(pathname, buffer, {
      access: "private" as unknown as "public",
      contentType,
      addRandomSuffix: true,
    });
    return { url: result.url };
  }

  async download(
    urlOrPath: string
  ): Promise<{ buffer: Buffer; contentType: string | null }> {
    if (this.isFullUrl(urlOrPath)) {
      return this.downloadFromBlob(urlOrPath);
    }
    return this.downloadFromFilesystem(urlOrPath);
  }

  private async deleteFromBlob(url: string): Promise<void> {
    const { del } = await import("@vercel/blob");
    await del(url);
  }

  private async uploadToFilesystem(
    folder: string,
    filename: string,
    buffer: Buffer
  ): Promise<StorageResult> {
    const { mkdir, writeFile } = await import("fs/promises");
    const dir = join(this.localUploadsRoot(), folder);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, filename);
    await writeFile(filePath, buffer);
    return { url: `uploads/${folder}/${filename}` };
  }

  private async deleteFromFilesystem(urlOrPath: string): Promise<void> {
    const { unlink } = await import("fs/promises");
    if (!StorageService.LOCAL_UPLOAD_PATH_RE.test(urlOrPath)) return;
    const filePath = this.localPathFromRelativeUrl(urlOrPath);
    try {
      await unlink(filePath);
    } catch {
      // ignore if file doesn't exist
    }
  }

  private async downloadFromBlob(
    url: string
  ): Promise<{ buffer: Buffer; contentType: string | null }> {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      throw new BadRequestException("Blob object not found");
    }
    const contentType = response.headers.get("content-type");
    const arrayBuffer = await response.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), contentType };
  }

  private async downloadFromFilesystem(
    urlOrPath: string
  ): Promise<{ buffer: Buffer; contentType: string | null }> {
    const { readFile } = await import("fs/promises");
    const filePath = this.localPathFromRelativeUrl(urlOrPath);
    const buffer = await readFile(filePath);
    return { buffer, contentType: null };
  }

  private localUploadsRoot(): string {
    const configured = process.env.LOCAL_UPLOADS_DIR?.trim();
    if (configured) return configured;
    return join(tmpdir(), "ideahome", "uploads");
  }

  private localPathFromRelativeUrl(urlOrPath: string): string {
    const match = urlOrPath.match(StorageService.LOCAL_UPLOAD_PATH_PARTS_RE);
    if (!match) {
      throw new BadRequestException("Unsafe file path");
    }
    const [, folder, filename] = match;
    return this.resolveLocalUploadPath(
      folder as "recordings" | "screenshots" | "files" | "taxes",
      filename
    );
  }
}
