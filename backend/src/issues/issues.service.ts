import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { StorageService } from "../storage.service";
import { existsSync } from "fs";
import { join } from "path";
import { createReadStream } from "fs";
import { Response } from "express";

const ISSUE_INCLUDE = {
  assignee: true,
  project: true,
  recordings: { orderBy: { createdAt: "asc" as const } },
  screenshots: { orderBy: { createdAt: "asc" as const } },
  files: { orderBy: { createdAt: "asc" as const } },
};

/** Project name to acronym, e.g. "Idea Home Launch" -> "IHL". */
function projectNameToAcronym(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "PRJ";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map((w) => (w[0] ?? "").toUpperCase()).join("");
  }
  return trimmed.slice(0, 3).toUpperCase() || "PRJ";
}

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  private async getOrgIdForUser(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      throw new NotFoundException(
        "User has no organization. Complete login again to create one."
      );
    }
    return user.organizationId;
  }

  private async verifyIssueBelongsToUser(
    issueId: string,
    userId: string
  ): Promise<void> {
    const orgId = await this.getOrgIdForUser(userId);
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });
    if (!issue || issue.project.organizationId !== orgId) {
      throw new NotFoundException("Issue not found");
    }
  }

  /** Public for use by IssueCommentsService. Verifies the issue belongs to the user's org. */
  async verifyIssueAccess(issueId: string, userId: string): Promise<void> {
    return this.verifyIssueBelongsToUser(issueId, userId);
  }

  private async verifyProjectBelongsToUser(
    projectId: string,
    userId: string
  ): Promise<void> {
    const orgId = await this.getOrgIdForUser(userId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.organizationId !== orgId) {
      throw new NotFoundException("Project not found");
    }
  }

  async list(projectId?: string, search?: string, userId?: string) {
    const where: Prisma.IssueWhereInput = {};
    if (userId) {
      const orgId = await this.getOrgIdForUser(userId);
      where.project = { organizationId: orgId };
    }
    if (projectId) where.projectId = projectId;
    if (search && search.trim()) {
      const term = search.trim();
      const contains = { contains: term, mode: "insensitive" as const };
      where.OR = [
        { title: contains },
        { description: contains },
        { acceptanceCriteria: contains },
        { database: contains },
        { api: contains },
        { testCases: contains },
        { automatedTest: contains },
      ];
    }
    return this.prisma.issue.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: ISSUE_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: string, userId?: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: ISSUE_INCLUDE,
    });
    if (!issue) throw new NotFoundException("Issue not found");
    if (userId) await this.verifyIssueBelongsToUser(id, userId);
    return issue;
  }

  async create(
    data: {
      title: string;
      description?: string;
      acceptanceCriteria?: string;
      database?: string;
      api?: string;
      testCases?: string;
      automatedTest?: string;
      qualityScore?: number;
      projectId: string;
      assigneeId?: string;
    },
    userId?: string
  ) {
    if (userId) await this.verifyProjectBelongsToUser(data.projectId, userId);
    const project = await this.prisma.project.findUnique({
      where: { id: data.projectId },
    });
    if (!project) throw new NotFoundException("Project not found");
    const count = await this.prisma.issue.count({
      where: { projectId: data.projectId },
    });
    const acronym = projectNameToAcronym(project.name);
    const key = `${acronym}-${count + 1}`;
    return this.prisma.issue.create({
      data: { ...data, key },
      include: ISSUE_INCLUDE,
    });
  }

  async update(id: string, data: Record<string, unknown>, userId?: string) {
    if (userId) await this.verifyIssueBelongsToUser(id, userId);
    const allowed = [
      "title",
      "description",
      "acceptanceCriteria",
      "database",
      "api",
      "testCases",
      "automatedTest",
      "qualityScore",
      "status",
      "assigneeId",
    ];
    const payload: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in data && data[key] !== undefined) payload[key] = data[key];
    }
    return this.prisma.issue.update({
      where: { id },
      data: payload as Prisma.IssueUpdateInput,
      include: ISSUE_INCLUDE,
    });
  }

  async updateStatus(id: string, status: string, userId?: string) {
    if (userId) await this.verifyIssueBelongsToUser(id, userId);
    return this.prisma.issue.update({
      where: { id },
      data: { status },
      include: ISSUE_INCLUDE,
    });
  }

  async delete(id: string, userId?: string) {
    if (userId) await this.verifyIssueBelongsToUser(id, userId);
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: { recordings: true, screenshots: true, files: true },
    });
    if (issue) {
      await this.deleteIssueFiles(issue);
    }
    return this.prisma.issue.delete({ where: { id } });
  }

  /** Delete all issues, optionally scoped by projectId. Cleans up related files. Only deletes issues in user's org. */
  async deleteMany(projectId: string | undefined, userId: string) {
    const orgId = await this.getOrgIdForUser(userId);
    const where: Prisma.IssueWhereInput = {
      project: { organizationId: orgId },
    };
    if (projectId) where.projectId = projectId;
    const issues = await this.prisma.issue.findMany({
      where,
      include: { recordings: true, screenshots: true, files: true },
    });
    for (const issue of issues) {
      await this.deleteIssueFiles(issue);
    }
    await this.prisma.issue.deleteMany({ where });
  }

  private async deleteIssueFiles(issue: {
    recordings: { videoUrl: string }[];
    screenshots: { imageUrl: string }[];
    files: { fileUrl: string }[];
  }) {
    for (const rec of issue.recordings) {
      await this.storage.delete(rec.videoUrl);
    }
    for (const shot of issue.screenshots) {
      await this.storage.delete(shot.imageUrl);
    }
    for (const f of issue.files) {
      await this.storage.delete(f.fileUrl);
    }
  }

  private static RECORDING_CONTENT_TYPES: Record<string, string> = {
    ".webm": "video/webm",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
  };

  /** Stream a recording file with correct Content-Type and range support for video/audio playback. */
  async streamRecording(
    filename: string,
    res: Response,
    userId?: string
  ): Promise<void> {
    const recording = await this.prisma.issueRecording.findFirst({
      where: { videoUrl: { endsWith: filename } },
      include: { issue: { include: { project: true } } },
    });
    if (!recording) throw new NotFoundException("Recording not found");
    if (userId) {
      const orgId = await this.getOrgIdForUser(userId);
      if (recording.issue.project.organizationId !== orgId) {
        throw new NotFoundException("Recording not found");
      }
    }
    if (this.storage.isFullUrl(recording.videoUrl)) {
      res.redirect(recording.videoUrl);
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+\.(webm|mp4|mov|mp3|m4a|ogg|wav)$/i.test(filename)) {
      throw new NotFoundException("Invalid recording filename");
    }
    const uploadsDir = join(process.cwd(), "uploads", "recordings");
    const filePath = join(uploadsDir, filename);
    if (!existsSync(filePath)) {
      throw new NotFoundException("Recording not found");
    }
    const ext = filename.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? "";
    const contentType =
      IssuesService.RECORDING_CONTENT_TYPES[ext] ??
      (filename.includes("-audio") ? "audio/webm" : "video/webm");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    const stream = createReadStream(filePath);
    stream.pipe(res);
  }

  async addRecording(
    issueId: string,
    videoBase64: string,
    mediaType: "video" | "audio" = "video",
    recordingType: "screen" | "camera" | "audio" = "screen",
    fileName?: string,
    userId?: string
  ) {
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException("Issue not found");

    let filename: string;
    let displayName: string | undefined;
    if (fileName && /\.(webm|mp4|mov|mp3|m4a|ogg|wav)$/i.test(fileName)) {
      const ext = fileName.replace(/^.*\./, "").toLowerCase();
      const baseName = fileName.replace(/\.[^/.]+$/, "").trim() || "upload";
      const safeBase = baseName.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
      filename = `${issueId}-${Date.now()}-${safeBase}.${ext}`.replace(
        /[^a-zA-Z0-9_.-]/g,
        "_"
      );
      displayName = fileName.trim();
    } else {
      const suffix = `-${recordingType}.webm`;
      filename = `${issueId}-${Date.now()}${suffix}`;
    }
    const buffer = Buffer.from(videoBase64, "base64");
    const ext = filename.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? ".webm";
    const contentType =
      IssuesService.RECORDING_CONTENT_TYPES[ext] ?? "video/webm";
    const { url: videoUrl } = await this.storage.upload(
      "recordings",
      filename,
      buffer,
      contentType
    );
    await this.prisma.issueRecording.create({
      data: {
        videoUrl,
        issueId,
        mediaType,
        recordingType,
        name: displayName ?? undefined,
      },
    });

    return this.get(issueId);
  }

  async updateRecording(
    issueId: string,
    recordingId: string,
    data: {
      mediaType?: "video" | "audio";
      recordingType?: "screen" | "camera" | "audio";
      name?: string | null;
    },
    userId?: string
  ) {
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const recording = await this.prisma.issueRecording.findFirst({
      where: { id: recordingId, issueId },
    });
    if (!recording) throw new NotFoundException("Recording not found");

    const payload: {
      mediaType?: string;
      recordingType?: string;
      name?: string | null;
    } = {};
    if (data.mediaType !== undefined) payload.mediaType = data.mediaType;
    if (data.recordingType !== undefined)
      payload.recordingType = data.recordingType;
    if (data.name !== undefined)
      payload.name = data.name === "" ? null : data.name;
    if (Object.keys(payload).length === 0) return this.get(issueId);

    await this.prisma.issueRecording.update({
      where: { id: recordingId },
      data: payload,
    });
    return this.get(issueId);
  }

  async removeRecording(issueId: string, recordingId: string, userId?: string) {
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const recording = await this.prisma.issueRecording.findFirst({
      where: { id: recordingId, issueId },
    });
    if (!recording) throw new NotFoundException("Recording not found");

    await this.storage.delete(recording.videoUrl);

    await this.prisma.issueRecording.delete({ where: { id: recordingId } });
    return this.get(issueId);
  }

  async addScreenshot(
    issueId: string,
    imageBase64: string,
    fileName?: string,
    userId?: string
  ) {
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException("Issue not found");

    const filename = `${issueId}-${Date.now()}.png`;
    const buffer = Buffer.from(imageBase64, "base64");
    const { url: imageUrl } = await this.storage.upload(
      "screenshots",
      filename,
      buffer,
      "image/png"
    );
    const name = fileName?.trim() || null;
    await this.prisma.issueScreenshot.create({
      data: { imageUrl, issueId, name },
    });

    return this.get(issueId);
  }

  async updateScreenshot(
    issueId: string,
    screenshotId: string,
    name?: string | null,
    userId?: string
  ) {
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const screenshot = await this.prisma.issueScreenshot.findUnique({
      where: { id: screenshotId },
    });
    if (!screenshot || screenshot.issueId !== issueId) {
      throw new NotFoundException("Screenshot not found");
    }
    const value =
      name === undefined
        ? undefined
        : name === null || (typeof name === "string" && name.trim() === "")
          ? null
          : name.trim();
    await this.prisma.issueScreenshot.update({
      where: { id: screenshotId },
      data: value === undefined ? {} : { name: value },
    });
    return this.get(issueId);
  }

  async removeScreenshot(
    issueId: string,
    screenshotId: string,
    userId?: string
  ) {
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const screenshot = await this.prisma.issueScreenshot.findFirst({
      where: { id: screenshotId, issueId },
    });
    if (!screenshot) throw new NotFoundException("Screenshot not found");

    await this.storage.delete(screenshot.imageUrl);

    await this.prisma.issueScreenshot.delete({ where: { id: screenshotId } });
    return this.get(issueId);
  }

  async addFile(
    issueId: string,
    fileBase64: string,
    fileName: string,
    userId?: string
  ) {
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException("Issue not found");

    const ext = fileName.includes(".") ? fileName.replace(/^.*\./, "") : "bin";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "bin";
    const filename = `${issueId}-${Date.now()}-${safeExt}`;
    const buffer = Buffer.from(fileBase64, "base64");
    const { url: fileUrl } = await this.storage.upload(
      "files",
      filename,
      buffer,
      "application/octet-stream"
    );
    await this.prisma.issueFile.create({
      data: { fileUrl, fileName, issueId },
    });

    return this.get(issueId);
  }

  async updateFile(
    issueId: string,
    fileId: string,
    data: { fileName?: string },
    userId?: string
  ) {
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const file = await this.prisma.issueFile.findFirst({
      where: { id: fileId, issueId },
    });
    if (!file) throw new NotFoundException("File not found");
    const fileName = data.fileName?.trim();
    if (fileName === undefined || fileName === "") return this.get(issueId);
    await this.prisma.issueFile.update({
      where: { id: fileId },
      data: { fileName },
    });
    return this.get(issueId);
  }

  async removeFile(issueId: string, fileId: string, userId?: string) {
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const file = await this.prisma.issueFile.findFirst({
      where: { id: fileId, issueId },
    });
    if (!file) throw new NotFoundException("File not found");

    await this.storage.delete(file.fileUrl);

    await this.prisma.issueFile.delete({ where: { id: fileId } });
    return this.get(issueId);
  }

  async streamFile(
    issueId: string,
    fileId: string,
    res: Response,
    userId?: string
  ): Promise<void> {
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const file = await this.prisma.issueFile.findFirst({
      where: { id: fileId, issueId },
    });
    if (!file) throw new NotFoundException("File not found");
    if (this.storage.isFullUrl(file.fileUrl)) {
      res.redirect(file.fileUrl);
      return;
    }
    const filePath = join(process.cwd(), file.fileUrl);
    if (!existsSync(filePath)) throw new NotFoundException("File not found");
    const safeName = file.fileName.replace(/[^\w.-]/g, "_");
    const isPdf = /\.pdf$/i.test(file.fileName);
    res.setHeader(
      "Content-Type",
      isPdf ? "application/pdf" : "application/octet-stream"
    );
    res.setHeader(
      "Content-Disposition",
      isPdf
        ? `inline; filename="${safeName}"`
        : `attachment; filename="${safeName}"`
    );
    const stream = createReadStream(filePath);
    stream.pipe(res);
  }
}
