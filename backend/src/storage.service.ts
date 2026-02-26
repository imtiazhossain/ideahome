import { BadRequestException, Injectable } from "@nestjs/common";

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
    /^uploads\/(recordings|screenshots|files)\/[a-zA-Z0-9_.-]+$/;
  private static readonly SAFE_FILENAME_RE = /^[a-zA-Z0-9_.-]+$/;

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
    folder: "recordings" | "screenshots" | "files",
    filename: string,
    buffer: Buffer,
    contentType?: string
  ): Promise<StorageResult> {
    this.validateFilename(filename);
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

  private async uploadToBlob(
    folder: string,
    filename: string,
    buffer: Buffer,
    contentType?: string
  ): Promise<StorageResult> {
    const { put } = await import("@vercel/blob");
    const pathname = `${folder}/${filename}`;
    const result = await put(pathname, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });
    return { url: result.url };
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
    const { join } = await import("path");
    const dir = join(process.cwd(), "uploads", folder);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, filename);
    await writeFile(filePath, buffer);
    return { url: `uploads/${folder}/${filename}` };
  }

  private async deleteFromFilesystem(urlOrPath: string): Promise<void> {
    if (!StorageService.LOCAL_UPLOAD_PATH_RE.test(urlOrPath)) {
      return;
    }
    const { unlink } = await import("fs/promises");
    const { join } = await import("path");
    const filePath = join(process.cwd(), urlOrPath);
    try {
      await unlink(filePath);
    } catch {
      // ignore if file doesn't exist
    }
  }
}
