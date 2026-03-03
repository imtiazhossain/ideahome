import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { IssuesService } from "./issues.service";
import { PrismaService } from "../prisma.service";
import { StorageService } from "../storage.service";

const COMMENT_INCLUDE = {
  editHistory: { orderBy: { editedAt: "asc" as const } },
  attachments: { orderBy: { createdAt: "asc" as const } },
};
const COMMENT_ATTACHMENT_TYPES = new Set([
  "screenshot",
  "video",
  "screen_recording",
  "camera_recording",
]);
const MAX_COMMENT_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_COMMENT_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB

@Injectable()
export class IssueCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issuesService: IssuesService,
    private readonly storage: StorageService
  ) {}

  private decodeBase64(value: string, field: string): Buffer {
    const normalized = this.stripDataUrlPrefix(value).replace(/\s+/g, "");
    if (
      normalized.length === 0 ||
      normalized.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
    ) {
      throw new BadRequestException(`${field} must be a valid base64 string`);
    }
    return Buffer.from(normalized, "base64");
  }

  private stripDataUrlPrefix(value: string): string {
    const trimmed = value.trim();
    if (!trimmed.toLowerCase().startsWith("data:")) return trimmed;
    const commaIdx = trimmed.indexOf(",");
    return commaIdx >= 0 ? trimmed.slice(commaIdx + 1) : trimmed;
  }

  private enforceMaxBytes(buffer: Buffer, maxBytes: number, field: string): void {
    if (buffer.byteLength > maxBytes) {
      throw new BadRequestException(
        `${field} too large (max ${Math.floor(maxBytes / (1024 * 1024))}MB)`
      );
    }
  }

  private detectImageType(
    buffer: Buffer
  ): { extension: "png" | "jpg" | "webp"; contentType: string } | null {
    if (
      buffer.byteLength >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { extension: "png", contentType: "image/png" };
    }
    if (
      buffer.byteLength >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return { extension: "jpg", contentType: "image/jpeg" };
    }
    if (
      buffer.byteLength >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return { extension: "webp", contentType: "image/webp" };
    }
    return null;
  }

  async list(issueId: string, userId: string) {
    await this.issuesService.verifyIssueAccess(issueId, userId);
    return this.prisma.issueComment.findMany({
      where: { issueId },
      orderBy: { createdAt: "asc" },
      include: COMMENT_INCLUDE,
    });
  }

  async create(issueId: string, body: unknown, userId: string) {
    await this.issuesService.verifyIssueAccess(issueId, userId);
    if (typeof body !== "string") {
      throw new BadRequestException("Comment body is required");
    }
    const text = body.trim();
    if (!text) throw new BadRequestException("Comment body is required");
    return this.prisma.issueComment.create({
      data: { issueId, body: text },
      include: COMMENT_INCLUDE,
    });
  }

  async update(
    issueId: string,
    commentId: string,
    body: unknown,
    userId: string
  ) {
    await this.issuesService.verifyIssueAccess(issueId, userId);
    const comment = await this.prisma.issueComment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.issueId !== issueId)
      throw new NotFoundException("Comment not found");
    if (typeof body !== "string") {
      throw new BadRequestException("Comment body is required");
    }
    const text = body.trim();
    if (!text) throw new BadRequestException("Comment body is required");
    if (comment.body === text) return this.getOne(commentId);

    await this.prisma.$transaction([
      this.prisma.issueCommentEdit.create({
        data: { commentId, body: comment.body },
      }),
      this.prisma.issueComment.update({
        where: { id: commentId },
        data: { body: text },
      }),
    ]);
    return this.getOne(commentId);
  }

  private async getOne(commentId: string) {
    const comment = await this.prisma.issueComment.findUnique({
      where: { id: commentId },
      include: COMMENT_INCLUDE,
    });
    if (!comment) throw new NotFoundException("Comment not found");
    return comment;
  }

  async addAttachment(
    issueId: string,
    commentId: string,
    payload: {
      type?: unknown;
      imageBase64?: unknown;
      videoBase64?: unknown;
    },
    userId: string
  ) {
    await this.issuesService.verifyIssueAccess(issueId, userId);
    const comment = await this.prisma.issueComment.findFirst({
      where: { id: commentId, issueId },
    });
    if (!comment) throw new NotFoundException("Comment not found");

    const { type, imageBase64, videoBase64 } = payload;
    if (typeof type !== "string") {
      throw new BadRequestException(
        "type must be one of: screenshot, video, screen_recording, camera_recording"
      );
    }
    if (!COMMENT_ATTACHMENT_TYPES.has(type)) {
      throw new BadRequestException(
        "type must be one of: screenshot, video, screen_recording, camera_recording"
      );
    }
    const imageB64 =
      typeof imageBase64 === "string" ? imageBase64.trim() : undefined;
    const videoB64 =
      typeof videoBase64 === "string" ? videoBase64.trim() : undefined;
    const isImage = type === "screenshot" && imageB64 && imageB64.length > 0;
    const isVideo =
      (type === "video" ||
        type === "screen_recording" ||
        type === "camera_recording") &&
      videoB64 &&
      videoB64.length > 0;

    if (!isImage && !isVideo) {
      throw new BadRequestException(
        type === "screenshot"
          ? "Provide a non-empty imageBase64 for screenshot"
          : "Provide a non-empty videoBase64 for video, screen_recording, or camera_recording"
      );
    }

    if (isImage) {
      const buffer = this.decodeBase64(imageB64, "imageBase64");
      this.enforceMaxBytes(buffer, MAX_COMMENT_IMAGE_BYTES, "imageBase64");
      const imageType = this.detectImageType(buffer);
      if (!imageType) {
        throw new BadRequestException(
          "imageBase64 must be a PNG, JPEG, or WEBP image"
        );
      }
      const filename = `comment-${commentId}-${Date.now()}.${imageType.extension}`;
      const { url: mediaUrl } = await this.storage.upload(
        "screenshots",
        filename,
        buffer,
        imageType.contentType
      );
      await this.prisma.commentAttachment.create({
        data: { commentId, type, mediaUrl },
      });
      return this.getOne(commentId);
    }

    const filename = `comment-${commentId}-${Date.now()}.webm`;
    const buffer = this.decodeBase64(videoB64!, "videoBase64");
    this.enforceMaxBytes(buffer, MAX_COMMENT_VIDEO_BYTES, "videoBase64");
    const { url: mediaUrl } = await this.storage.upload(
      "recordings",
      filename,
      buffer,
      "video/webm"
    );
    await this.prisma.commentAttachment.create({
      data: { commentId, type, mediaUrl },
    });
    return this.getOne(commentId);
  }

  async removeAttachment(
    issueId: string,
    commentId: string,
    attachmentId: string,
    userId: string
  ) {
    await this.issuesService.verifyIssueAccess(issueId, userId);
    const attachment = await this.prisma.commentAttachment.findFirst({
      where: { id: attachmentId, comment: { id: commentId, issueId } },
    });
    if (!attachment) throw new NotFoundException("Attachment not found");

    await this.storage.delete(attachment.mediaUrl);

    await this.prisma.commentAttachment.delete({ where: { id: attachmentId } });
    return this.getOne(commentId);
  }

  async delete(issueId: string, commentId: string, userId: string) {
    await this.issuesService.verifyIssueAccess(issueId, userId);
    const comment = await this.prisma.issueComment.findFirst({
      where: { id: commentId, issueId },
      include: { attachments: true },
    });
    if (!comment) throw new NotFoundException("Comment not found");

    for (const att of comment.attachments) {
      await this.storage.delete(att.mediaUrl);
    }
    await this.prisma.issueComment.delete({ where: { id: commentId } });
  }
}
