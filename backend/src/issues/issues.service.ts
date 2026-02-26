import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { getOrgIdForUser, verifyProjectInOrg } from "../common/org-scope";
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
const ISSUE_STATUSES = new Set(["backlog", "todo", "in_progress", "done"]);
const ISSUE_MEDIA_TYPES = new Set(["video", "audio"]);
const ISSUE_RECORDING_TYPES = new Set(["screen", "camera", "audio"]);

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
  private static readonly LOCAL_FILE_URL_RE = /^uploads\/files\/[a-zA-Z0-9_.-]+$/;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  private async getOrgIdForUser(userId: string): Promise<string> {
    return getOrgIdForUser(
      this.prisma,
      userId,
      new NotFoundException(
        "User has no organization. Complete login again to create one."
      )
    );
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
    await verifyProjectInOrg(this.prisma, projectId, orgId);
  }

  private normalizeRequiredTitle(value: unknown): string {
    if (typeof value !== "string") {
      throw new BadRequestException("title is required");
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException("title is required");
    }
    return trimmed;
  }

  private normalizeRequiredProjectId(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return value.trim();
  }

  private normalizeOptionalProjectId(value: unknown): string | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string") {
      throw new BadRequestException("projectId must be a string");
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException("projectId must be a non-empty string");
    }
    return trimmed;
  }

  private normalizeOptionalTextField(
    value: unknown,
    field: string
  ): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") {
      throw new BadRequestException(`${field} must be a string`);
    }
    return value;
  }

  private normalizeOptionalAssigneeId(value: unknown): string | null | undefined {
    if (value === undefined || value === null) return value as
      | null
      | undefined;
    if (typeof value !== "string") {
      throw new BadRequestException("assigneeId must be a string or null");
    }
    const trimmed = value.trim();
    return trimmed || null;
  }

  async list(projectId?: string, search?: string, userId?: string) {
    const safeProjectId = this.normalizeOptionalProjectId(projectId);
    const where: Prisma.IssueWhereInput = {};
    if (userId) {
      const orgId = await this.getOrgIdForUser(userId);
      where.project = { organizationId: orgId };
    }
    if (safeProjectId) where.projectId = safeProjectId;
    if (typeof search === "string" && search.trim()) {
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
      title?: unknown;
      description?: unknown;
      acceptanceCriteria?: unknown;
      database?: unknown;
      api?: unknown;
      testCases?: unknown;
      automatedTest?: unknown;
      status?: unknown;
      qualityScore?: unknown;
      projectId?: unknown;
      assigneeId?: unknown;
    },
    userId?: string
  ) {
    const title = this.normalizeRequiredTitle(data.title);
    const projectId = this.normalizeRequiredProjectId(data.projectId);
    const description = this.normalizeOptionalTextField(
      data.description,
      "description"
    );
    const acceptanceCriteria = this.normalizeOptionalTextField(
      data.acceptanceCriteria,
      "acceptanceCriteria"
    );
    const database = this.normalizeOptionalTextField(data.database, "database");
    const api = this.normalizeOptionalTextField(data.api, "api");
    const testCases = this.normalizeOptionalTextField(
      data.testCases,
      "testCases"
    );
    const automatedTest = this.normalizeOptionalTextField(
      data.automatedTest,
      "automatedTest"
    );
    const assigneeId = this.normalizeOptionalAssigneeId(data.assigneeId);
    const status = typeof data.status === "string" ? data.status : undefined;
    const qualityScore =
      typeof data.qualityScore === "number" ? data.qualityScore : undefined;
    if (userId) await this.verifyProjectBelongsToUser(projectId, userId);
    this.validateStatus(data.status);
    this.validateQualityScore(data.qualityScore);
    await this.validateAssigneeInProjectOrg(projectId, assigneeId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException("Project not found");
    const acronym = projectNameToAcronym(project.name);

    // Generate project-local keys safely under concurrent creates.
    for (let attempt = 0; attempt < 5; attempt++) {
      const key = await this.nextIssueKey(projectId, acronym);
      try {
        return await this.prisma.issue.create({
          data: {
            projectId,
            title,
            description,
            acceptanceCriteria,
            database,
            api,
            testCases,
            automatedTest,
            status,
            qualityScore,
            assigneeId,
            key,
          },
          include: ISSUE_INCLUDE,
        });
      } catch (e) {
        if (
          e instanceof PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue;
        }
        throw e;
      }
    }

    throw new InternalServerErrorException(
      "Could not allocate a unique issue key"
    );
  }

  private async nextIssueKey(projectId: string, acronym: string): Promise<string> {
    const prefix = `${acronym}-`;
    const rows = await this.prisma.issue.findMany({
      where: { projectId, key: { startsWith: prefix } },
      select: { key: true },
    });
    let max = 0;
    for (const row of rows ?? []) {
      const key = row.key ?? "";
      const suffix = key.slice(prefix.length);
      const n = Number.parseInt(suffix, 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return `${prefix}${max + 1}`;
  }

  async update(id: string, data: Record<string, unknown>, userId?: string) {
    if (userId) await this.verifyIssueBelongsToUser(id, userId);
    const existing = await this.prisma.issue.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!existing) throw new NotFoundException("Issue not found");
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
    if ("title" in payload) {
      payload.title = this.normalizeRequiredTitle(payload.title);
    }
    for (const key of [
      "description",
      "acceptanceCriteria",
      "database",
      "api",
      "testCases",
      "automatedTest",
    ]) {
      if (key in payload) {
        payload[key] = this.normalizeOptionalTextField(payload[key], key);
      }
    }
    if ("assigneeId" in payload) {
      payload.assigneeId = this.normalizeOptionalAssigneeId(payload.assigneeId);
    }
    if ("status" in payload) this.validateStatus(payload.status);
    if ("qualityScore" in payload) this.validateQualityScore(payload.qualityScore);
    if ("assigneeId" in payload) {
      await this.validateAssigneeInProjectOrg(
        existing.projectId,
        (payload.assigneeId as string | null | undefined) ?? undefined
      );
    }
    return this.prisma.issue.update({
      where: { id },
      data: payload as Prisma.IssueUpdateInput,
      include: ISSUE_INCLUDE,
    });
  }

  private async validateAssigneeInProjectOrg(
    projectId: string,
    assigneeId?: string | null
  ): Promise<void> {
    if (assigneeId === undefined || assigneeId === null || assigneeId === "") return;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new NotFoundException("Project not found");
    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: { organizationId: true },
    });
    if (!assignee || assignee.organizationId !== project.organizationId) {
      throw new BadRequestException("Assignee must belong to the issue project organization");
    }
  }

  async updateStatus(id: string, status: unknown, userId?: string) {
    if (userId) await this.verifyIssueBelongsToUser(id, userId);
    if (typeof status !== "string" || !status.trim()) {
      throw new BadRequestException(
        "status must be one of: backlog, todo, in_progress, done"
      );
    }
    this.validateStatus(status);
    return this.prisma.issue.update({
      where: { id },
      data: { status },
      include: ISSUE_INCLUDE,
    });
  }

  private validateStatus(status: unknown): void {
    if (status === undefined) return;
    if (typeof status !== "string" || !ISSUE_STATUSES.has(status)) {
      throw new BadRequestException(
        "status must be one of: backlog, todo, in_progress, done"
      );
    }
  }

  private validateQualityScore(score: unknown): void {
    if (score === undefined) return;
    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    ) {
      throw new BadRequestException("qualityScore must be a number between 0 and 100");
    }
  }

  private validateNonEmptyBase64(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private validateRecordingMediaType(value: unknown): "video" | "audio" {
    if (typeof value !== "string" || !ISSUE_MEDIA_TYPES.has(value)) {
      throw new BadRequestException("mediaType must be one of: video, audio");
    }
    return value as "video" | "audio";
  }

  private validateRecordingType(
    value: unknown
  ): "screen" | "camera" | "audio" {
    if (typeof value !== "string" || !ISSUE_RECORDING_TYPES.has(value)) {
      throw new BadRequestException(
        "recordingType must be one of: screen, camera, audio"
      );
    }
    return value as "screen" | "camera" | "audio";
  }

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
    const safeProjectId = this.normalizeOptionalProjectId(projectId);
    const orgId = await this.getOrgIdForUser(userId);
    const where: Prisma.IssueWhereInput = {
      project: { organizationId: orgId },
    };
    if (safeProjectId) where.projectId = safeProjectId;
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
    stream.on("error", () => {
      if (!res.headersSent) {
        res.status(500).end();
        return;
      }
      res.end();
    });
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
    const safeVideoBase64 = this.validateNonEmptyBase64(
      videoBase64,
      "videoBase64"
    );
    const safeMediaType = this.validateRecordingMediaType(mediaType);
    const safeRecordingType = this.validateRecordingType(recordingType);
    const buffer = this.decodeBase64(safeVideoBase64, "videoBase64");
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
      const suffix = `-${safeRecordingType}.webm`;
      filename = `${issueId}-${Date.now()}${suffix}`;
    }
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
        mediaType: safeMediaType,
        recordingType: safeRecordingType,
        name: displayName ?? undefined,
      },
    });

    return this.get(issueId);
  }

  async updateRecording(
    issueId: string,
    recordingId: string,
    data: {
      mediaType?: unknown;
      recordingType?: unknown;
      name?: unknown;
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
    if (data.mediaType !== undefined) {
      payload.mediaType = this.validateRecordingMediaType(data.mediaType);
    }
    if (data.recordingType !== undefined)
      payload.recordingType = this.validateRecordingType(data.recordingType);
    if (data.name !== undefined) {
      if (data.name !== null && typeof data.name !== "string") {
        throw new BadRequestException("name must be a string or null");
      }
      if (data.name === null) {
        payload.name = null;
      } else {
        const trimmed = data.name.trim();
        payload.name = trimmed ? trimmed : null;
      }
    }
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
    const safeImageBase64 = this.validateNonEmptyBase64(
      imageBase64,
      "imageBase64"
    );
    const buffer = this.decodeBase64(safeImageBase64, "imageBase64");
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException("Issue not found");

    const filename = `${issueId}-${Date.now()}.png`;
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
    if (name !== undefined && name !== null && typeof name !== "string") {
      throw new BadRequestException("name must be a string or null");
    }
    const value =
      name === undefined ? undefined : name === null || name.trim() === "" ? null : name.trim();
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
    if (typeof fileBase64 !== "string" || typeof fileName !== "string") {
      throw new BadRequestException("fileBase64 and fileName are required");
    }
    const trimmedName = fileName.trim();
    const trimmedBase64 = fileBase64.trim();
    if (!trimmedName || !trimmedBase64) {
      throw new BadRequestException("fileBase64 and fileName are required");
    }
    const buffer = this.decodeBase64(trimmedBase64, "fileBase64");
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException("Issue not found");

    const ext = trimmedName.includes(".")
      ? trimmedName.replace(/^.*\./, "")
      : "bin";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "bin";
    const filename = `${issueId}-${Date.now()}-${safeExt}`;
    const { url: fileUrl } = await this.storage.upload(
      "files",
      filename,
      buffer,
      "application/octet-stream"
    );
    await this.prisma.issueFile.create({
      data: { fileUrl, fileName: trimmedName, issueId },
    });

    return this.get(issueId);
  }

  async updateFile(
    issueId: string,
    fileId: string,
    data: { fileName?: unknown },
    userId?: string
  ) {
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const file = await this.prisma.issueFile.findFirst({
      where: { id: fileId, issueId },
    });
    if (!file) throw new NotFoundException("File not found");
    if (data.fileName !== undefined && typeof data.fileName !== "string") {
      throw new BadRequestException("fileName must be a string");
    }
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
    if (!IssuesService.LOCAL_FILE_URL_RE.test(file.fileUrl)) {
      throw new NotFoundException("File not found");
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
