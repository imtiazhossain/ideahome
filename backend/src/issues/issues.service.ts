import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { writeFile, mkdir, unlink } from "fs/promises";
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
    return words
      .map((w) => (w[0] ?? "").toUpperCase())
      .join("");
  }
  return trimmed.slice(0, 3).toUpperCase() || "PRJ";
}

@Injectable()
export class IssuesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId?: string, search?: string) {
    const where: Prisma.IssueWhereInput = projectId ? { projectId } : {};
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

  async get(id: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: ISSUE_INCLUDE,
    });
    if (!issue) throw new NotFoundException("Issue not found");
    return issue;
  }

  async create(data: {
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
  }) {
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

  async update(id: string, data: Record<string, unknown>) {
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

  async updateStatus(id: string, status: string) {
    return this.prisma.issue.update({
      where: { id },
      data: { status },
      include: ISSUE_INCLUDE,
    });
  }

  async delete(id: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: { recordings: true, screenshots: true, files: true },
    });
    if (issue) {
      this.deleteIssueFiles(issue);
    }
    return this.prisma.issue.delete({ where: { id } });
  }

  /** Delete all issues, optionally scoped by projectId. Cleans up related files. */
  async deleteMany(projectId?: string) {
    const where: Prisma.IssueWhereInput = projectId ? { projectId } : {};
    const issues = await this.prisma.issue.findMany({
      where,
      include: { recordings: true, screenshots: true, files: true },
    });
    for (const issue of issues) {
      this.deleteIssueFiles(issue);
    }
    await this.prisma.issue.deleteMany({ where });
  }

  private deleteIssueFiles(issue: {
    recordings: { videoUrl: string }[];
    screenshots: { imageUrl: string }[];
    files: { fileUrl: string }[];
  }) {
    for (const rec of issue.recordings) {
      const filePath = join(__dirname, "..", "..", rec.videoUrl);
      if (existsSync(filePath)) unlink(filePath).catch(() => {});
    }
    for (const shot of issue.screenshots) {
      const filePath = join(__dirname, "..", "..", shot.imageUrl);
      if (existsSync(filePath)) unlink(filePath).catch(() => {});
    }
    for (const f of issue.files) {
      const filePath = join(__dirname, "..", "..", f.fileUrl);
      if (existsSync(filePath)) unlink(filePath).catch(() => {});
    }
  }

  private get uploadsDir(): string {
    return join(__dirname, "..", "..", "uploads", "recordings");
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
  streamRecording(filename: string, res: Response): void {
    if (!/^[a-zA-Z0-9_.-]+\.(webm|mp4|mov|mp3|m4a|ogg|wav)$/i.test(filename)) {
      throw new NotFoundException("Invalid recording filename");
    }
    const filePath = join(this.uploadsDir, filename);
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
    fileName?: string
  ) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException("Issue not found");

    await mkdir(this.uploadsDir, { recursive: true });

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
    const filePath = join(this.uploadsDir, filename);
    const buffer = Buffer.from(videoBase64, "base64");
    await writeFile(filePath, buffer);

    const videoUrl = `uploads/recordings/${filename}`;
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
    }
  ) {
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

  async removeRecording(issueId: string, recordingId: string) {
    const recording = await this.prisma.issueRecording.findFirst({
      where: { id: recordingId, issueId },
    });
    if (!recording) throw new NotFoundException("Recording not found");

    const filePath = join(__dirname, "..", "..", recording.videoUrl);
    if (existsSync(filePath)) await unlink(filePath).catch(() => {});

    await this.prisma.issueRecording.delete({ where: { id: recordingId } });
    return this.get(issueId);
  }

  private get screenshotsDir(): string {
    return join(__dirname, "..", "..", "uploads", "screenshots");
  }

  async addScreenshot(issueId: string, imageBase64: string, fileName?: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException("Issue not found");

    await mkdir(this.screenshotsDir, { recursive: true });

    const filename = `${issueId}-${Date.now()}.png`;
    const filePath = join(this.screenshotsDir, filename);
    const buffer = Buffer.from(imageBase64, "base64");
    await writeFile(filePath, buffer);

    const imageUrl = `uploads/screenshots/${filename}`;
    const name = fileName?.trim() || null;
    await this.prisma.issueScreenshot.create({
      data: { imageUrl, issueId, name },
    });

    return this.get(issueId);
  }

  async updateScreenshot(
    issueId: string,
    screenshotId: string,
    name?: string | null
  ) {
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

  async removeScreenshot(issueId: string, screenshotId: string) {
    const screenshot = await this.prisma.issueScreenshot.findFirst({
      where: { id: screenshotId, issueId },
    });
    if (!screenshot) throw new NotFoundException("Screenshot not found");

    const filePath = join(__dirname, "..", "..", screenshot.imageUrl);
    if (existsSync(filePath)) await unlink(filePath).catch(() => {});

    await this.prisma.issueScreenshot.delete({ where: { id: screenshotId } });
    return this.get(issueId);
  }

  private get filesDir(): string {
    return join(__dirname, "..", "..", "uploads", "files");
  }

  async addFile(issueId: string, fileBase64: string, fileName: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException("Issue not found");

    await mkdir(this.filesDir, { recursive: true });

    const ext = fileName.includes(".") ? fileName.replace(/^.*\./, "") : "bin";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "bin";
    const filename = `${issueId}-${Date.now()}-${safeExt}`;
    const filePath = join(this.filesDir, filename);
    const buffer = Buffer.from(fileBase64, "base64");
    await writeFile(filePath, buffer);

    const fileUrl = `uploads/files/${filename}`;
    await this.prisma.issueFile.create({
      data: { fileUrl, fileName, issueId },
    });

    return this.get(issueId);
  }

  async updateFile(
    issueId: string,
    fileId: string,
    data: { fileName?: string }
  ) {
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

  async removeFile(issueId: string, fileId: string) {
    const file = await this.prisma.issueFile.findFirst({
      where: { id: fileId, issueId },
    });
    if (!file) throw new NotFoundException("File not found");

    const filePath = join(__dirname, "..", "..", file.fileUrl);
    if (existsSync(filePath)) await unlink(filePath).catch(() => {});

    await this.prisma.issueFile.delete({ where: { id: fileId } });
    return this.get(issueId);
  }

  async streamFile(
    issueId: string,
    fileId: string,
    res: Response
  ): Promise<void> {
    const file = await this.prisma.issueFile.findFirst({
      where: { id: fileId, issueId },
    });
    if (!file) throw new NotFoundException("File not found");
    const filePath = join(__dirname, "..", "..", file.fileUrl);
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
