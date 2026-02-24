import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const COMMENT_INCLUDE = {
  editHistory: { orderBy: { editedAt: "asc" as const } },
  attachments: { orderBy: { createdAt: "asc" as const } },
};

@Injectable()
export class IssueCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private get recordingsDir(): string {
    return join(__dirname, "..", "..", "uploads", "recordings");
  }

  private get screenshotsDir(): string {
    return join(__dirname, "..", "..", "uploads", "screenshots");
  }

  async list(issueId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException("Issue not found");
    return this.prisma.issueComment.findMany({
      where: { issueId },
      orderBy: { createdAt: "asc" },
      include: COMMENT_INCLUDE,
    });
  }

  async create(issueId: string, body: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException("Issue not found");
    return this.prisma.issueComment.create({
      data: { issueId, body },
      include: COMMENT_INCLUDE,
    });
  }

  async update(issueId: string, commentId: string, body: string) {
    const comment = await this.prisma.issueComment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.issueId !== issueId)
      throw new NotFoundException("Comment not found");
    if (comment.body === body.trim()) return this.getOne(commentId);

    await this.prisma.$transaction([
      this.prisma.issueCommentEdit.create({
        data: { commentId, body: comment.body },
      }),
      this.prisma.issueComment.update({
        where: { id: commentId },
        data: { body: body.trim() },
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
      type: "screenshot" | "video" | "screen_recording" | "camera_recording";
      imageBase64?: string;
      videoBase64?: string;
    }
  ) {
    const comment = await this.prisma.issueComment.findFirst({
      where: { id: commentId, issueId },
    });
    if (!comment) throw new NotFoundException("Comment not found");

    const { type, imageBase64, videoBase64 } = payload;
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
      await mkdir(this.screenshotsDir, { recursive: true });
      const filename = `comment-${commentId}-${Date.now()}.png`;
      const filePath = join(this.screenshotsDir, filename);
      const buffer = Buffer.from(imageB64, "base64");
      await writeFile(filePath, buffer);
      const mediaUrl = `uploads/screenshots/${filename}`;
      const attachment = await this.prisma.commentAttachment.create({
        data: { commentId, type, mediaUrl },
      });
      return this.getOne(commentId);
    }

    await mkdir(this.recordingsDir, { recursive: true });
    const filename = `comment-${commentId}-${Date.now()}.webm`;
    const filePath = join(this.recordingsDir, filename);
    const buffer = Buffer.from(videoB64!, "base64");
    await writeFile(filePath, buffer);
    const mediaUrl = `uploads/recordings/${filename}`;
    await this.prisma.commentAttachment.create({
      data: { commentId, type, mediaUrl },
    });
    return this.getOne(commentId);
  }

  async removeAttachment(
    issueId: string,
    commentId: string,
    attachmentId: string
  ) {
    const attachment = await this.prisma.commentAttachment.findFirst({
      where: { id: attachmentId, comment: { id: commentId, issueId } },
    });
    if (!attachment) throw new NotFoundException("Attachment not found");

    const filePath = join(__dirname, "..", "..", attachment.mediaUrl);
    if (existsSync(filePath)) await unlink(filePath).catch(() => {});

    await this.prisma.commentAttachment.delete({ where: { id: attachmentId } });
    return this.getOne(commentId);
  }

  async delete(issueId: string, commentId: string) {
    const comment = await this.prisma.issueComment.findFirst({
      where: { id: commentId, issueId },
      include: { attachments: true },
    });
    if (!comment) throw new NotFoundException("Comment not found");

    for (const att of comment.attachments) {
      const filePath = join(__dirname, "..", "..", att.mediaUrl);
      if (existsSync(filePath)) await unlink(filePath).catch(() => {});
    }
    await this.prisma.issueComment.delete({ where: { id: commentId } });
  }
}
