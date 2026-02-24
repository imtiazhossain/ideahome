import { Injectable } from "@nestjs/common";

export interface StorageResult {
  url: string;
}

/**
 * Abstraction for file storage. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
 * otherwise uses local filesystem (for local dev).
 */
@Injectable()
export class StorageService {
  private useBlob(): boolean {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  }

  async upload(
    folder: "recordings" | "screenshots" | "files",
    filename: string,
    buffer: Buffer,
    contentType?: string
  ): Promise<StorageResult> {
    if (this.useBlob()) {
      return this.uploadToBlob(folder, filename, buffer, contentType);
    }
    return this.uploadToFilesystem(folder, filename, buffer);
  }

  async delete(urlOrPath: string): Promise<void> {
    if (urlOrPath.startsWith("http")) {
      await this.deleteFromBlob(urlOrPath);
    } else {
      await this.deleteFromFilesystem(urlOrPath);
    }
  }

  /** Returns true if the URL is a full URL (Blob) that can be used directly. */
  isFullUrl(urlOrPath: string): boolean {
    return urlOrPath.startsWith("http");
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
