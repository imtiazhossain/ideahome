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

@Injectable()
export class IssueCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issuesService: IssuesService,
    private readonly storage: StorageService
  ) {}

  private decodeBase64(value: string, field: string): Buffer {
    const normalized = value.replace(/\s+/g, "");
    if (
      normalized.length === 0 ||
      normalized.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
    ) {
      throw new BadRequestException(`${field} must be a valid base64 string`);
    }
    return Buffer.from(normalized, "base64");
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
      const filename = `comment-${commentId}-${Date.now()}.png`;
      const buffer = this.decodeBase64(imageB64, "imageBase64");
      const { url: mediaUrl } = await this.storage.upload(
        "screenshots",
        filename,
        buffer,
        "image/png"
      );
      await this.prisma.commentAttachment.create({
        data: { commentId, type, mediaUrl },
      });
      return this.getOne(commentId);
    }

    const filename = `comment-${commentId}-${Date.now()}.webm`;
    const buffer = this.decodeBase64(videoB64!, "videoBase64");
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
