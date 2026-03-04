import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import {
  computeQualityScorePercent,
  createDefaultQualityScoreConfig,
  normalizeQualityScoreConfig,
  projectNameToAcronym,
  type ProjectQualityScoreConfig,
} from "@ideahome/shared-config";
import { verifyProjectForUser } from "../common/org-scope";
import { PrismaService } from "../prisma.service";
import { StorageService } from "../storage.service";
import { existsSync } from "fs";
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
const MAX_RECORDING_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_SCREENSHOT_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB
const BLOCKED_FILE_EXTENSIONS = new Set([
  "apk",
  "app",
  "bat",
  "cmd",
  "com",
  "cpl",
  "dll",
  "exe",
  "hta",
  "html",
  "htm",
  "jar",
  "js",
  "jse",
  "mjs",
  "msi",
  "php",
  "ps1",
  "py",
  "rb",
  "scr",
  "sh",
  "svg",
  "vbs",
  "wsf",
]);

type IssueScoreInput = {
  id?: string;
  title?: string | null;
  description?: string | null;
  acceptanceCriteria?: string | null;
  database?: string | null;
  api?: string | null;
  testCases?: string | null;
  automatedTest?: string | null;
  assigneeId?: string | null;
  _count?: {
    comments?: number;
    screenshots?: number;
    recordings?: number;
    files?: number;
  };
};

@Injectable()
export class IssuesService {
  private static readonly LOCAL_FILE_URL_RE =
    /^uploads\/files\/[a-zA-Z0-9_.-]+$/;
  private static readonly LOCAL_SCREENSHOT_URL_RE =
    /^uploads\/screenshots\/[a-zA-Z0-9_.-]+$/;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  private async verifyIssueBelongsToUser(
    issueId: string,
    userId: string
  ): Promise<void> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        project: {
          select: {
            memberships: {
              where: { userId },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!issue || issue.project.memberships.length === 0) {
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
    await verifyProjectForUser(this.prisma, projectId, userId);
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

  private normalizeOptionalAssigneeId(
    value: unknown
  ): string | null | undefined {
    if (value === undefined || value === null) return value as null | undefined;
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
      where.project = { memberships: { some: { userId } } };
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
    if (userId) await this.verifyProjectBelongsToUser(projectId, userId);
    this.validateStatus(data.status);
    this.validateQualityScore(data.qualityScore);
    await this.validateAssigneeInProject(projectId, assigneeId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        qualityScoreConfig: true,
      },
    });
    if (!project) throw new NotFoundException("Project not found");
    const acronym = projectNameToAcronym(project.name);
    const projectConfig = this.projectQualityScoreConfig(project.qualityScoreConfig);
    const computedQualityScore = this.computeIssueQualityScore(
      {
        title,
        description,
        acceptanceCriteria,
        database,
        api,
        testCases,
        automatedTest,
        assigneeId,
        _count: { comments: 0, screenshots: 0, recordings: 0, files: 0 },
      },
      projectConfig
    );

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
            qualityScore: computedQualityScore,
            assigneeId,
            key,
          },
          include: ISSUE_INCLUDE,
        });
      } catch (e) {
        if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
          continue;
        }
        throw e;
      }
    }

    throw new InternalServerErrorException(
      "Could not allocate a unique issue key"
    );
  }

  private async nextIssueKey(
    projectId: string,
    acronym: string
  ): Promise<string> {
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
      select: {
        projectId: true,
        title: true,
        description: true,
        acceptanceCriteria: true,
        database: true,
        api: true,
        testCases: true,
        automatedTest: true,
        assigneeId: true,
        project: { select: { qualityScoreConfig: true } },
        _count: {
          select: {
            comments: true,
            screenshots: true,
            recordings: true,
            files: true,
          },
        },
      },
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
    if ("qualityScore" in payload)
      this.validateQualityScore(payload.qualityScore);
    if ("qualityScore" in payload) delete payload.qualityScore;
    if ("assigneeId" in payload) {
      await this.validateAssigneeInProject(
        existing.projectId,
        (payload.assigneeId as string | null | undefined) ?? undefined
      );
    }
    const projectConfig = this.projectQualityScoreConfig(
      existing.project?.qualityScoreConfig ?? null
    );
    const mergedForScore: IssueScoreInput = {
      title: ("title" in payload
        ? payload.title
        : existing.title) as string | null | undefined,
      description: ("description" in payload
        ? payload.description
        : existing.description) as string | null | undefined,
      acceptanceCriteria: ("acceptanceCriteria" in payload
        ? payload.acceptanceCriteria
        : existing.acceptanceCriteria) as string | null | undefined,
      database: ("database" in payload
        ? payload.database
        : existing.database) as string | null | undefined,
      api: ("api" in payload
        ? payload.api
        : existing.api) as string | null | undefined,
      testCases: ("testCases" in payload
        ? payload.testCases
        : existing.testCases) as string | null | undefined,
      automatedTest: ("automatedTest" in payload
        ? payload.automatedTest
        : existing.automatedTest) as string | null | undefined,
      assigneeId: ("assigneeId" in payload
        ? payload.assigneeId
        : existing.assigneeId) as string | null | undefined,
      _count: existing._count ?? {
        comments: 0,
        screenshots: 0,
        recordings: 0,
        files: 0,
      },
    };
    payload.qualityScore = this.computeIssueQualityScore(
      mergedForScore,
      projectConfig
    );
    return this.prisma.issue.update({
      where: { id },
      data: payload as Prisma.IssueUpdateInput,
      include: ISSUE_INCLUDE,
    });
  }

  private async validateAssigneeInProject(
    projectId: string,
    assigneeId?: string | null
  ): Promise<void> {
    if (assigneeId === undefined || assigneeId === null || assigneeId === "")
      return;
    const assigneeMembership = await this.prisma.projectMembership.findUnique({
      where: { projectId_userId: { projectId, userId: assigneeId } },
      select: { id: true },
    });
    if (!assigneeMembership) {
      throw new BadRequestException(
        "Assignee must be invited to the issue project"
      );
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
      throw new BadRequestException(
        "qualityScore must be a number between 0 and 100"
      );
    }
  }

  private projectQualityScoreConfig(
    value: unknown
  ): ProjectQualityScoreConfig {
    return normalizeQualityScoreConfig(value ?? createDefaultQualityScoreConfig());
  }

  private computeIssueQualityScore(
    issue: IssueScoreInput,
    config: ProjectQualityScoreConfig
  ): number {
    return computeQualityScorePercent(
      issue as unknown as Record<string, unknown>,
      config
    );
  }

  async recomputeIssueQualityScore(issueId: string): Promise<number> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        title: true,
        description: true,
        acceptanceCriteria: true,
        database: true,
        api: true,
        testCases: true,
        automatedTest: true,
        assigneeId: true,
        project: {
          select: { qualityScoreConfig: true },
        },
        _count: {
          select: {
            comments: true,
            screenshots: true,
            recordings: true,
            files: true,
          },
        },
      },
    });
    if (!issue) throw new NotFoundException("Issue not found");
    const config = this.projectQualityScoreConfig(issue.project.qualityScoreConfig);
    const qualityScore = this.computeIssueQualityScore(issue, config);
    await this.prisma.issue.update({
      where: { id: issueId },
      data: { qualityScore },
    });
    return qualityScore;
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

  private validateRecordingType(value: unknown): "screen" | "camera" | "audio" {
    if (typeof value !== "string" || !ISSUE_RECORDING_TYPES.has(value)) {
      throw new BadRequestException(
        "recordingType must be one of: screen, camera, audio"
      );
    }
    return value as "screen" | "camera" | "audio";
  }

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

  private extensionFromName(fileName: string): string {
    const match = fileName.toLowerCase().match(/\.([a-z0-9]{1,16})$/);
    return match?.[1] ?? "";
  }

  private validateUploadableFileName(fileName: string): void {
    const ext = this.extensionFromName(fileName);
    if (ext && BLOCKED_FILE_EXTENSIONS.has(ext)) {
      throw new BadRequestException(`.${ext} files are not allowed`);
    }
  }

  private fileContentTypeFromName(fileName: string): string {
    const ext = this.extensionFromName(fileName);
    if (ext === "pdf") return "application/pdf";
    if (ext === "txt") return "text/plain; charset=utf-8";
    if (ext === "csv") return "text/csv; charset=utf-8";
    if (ext === "json") return "application/json";
    if (ext === "png") return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "webp") return "image/webp";
    return "application/octet-stream";
  }

  private applySecureDownloadHeaders(res: Response): void {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
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
    const where: Prisma.IssueWhereInput = {
      project: { memberships: { some: { userId } } },
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
      include: { issue: true },
    });
    if (!recording) throw new NotFoundException("Recording not found");
    if (userId) {
      await this.verifyIssueBelongsToUser(recording.issueId, userId);
    }
    if (this.storage.isFullUrl(recording.videoUrl)) {
      const { buffer, contentType } = await this.storage.download(
        recording.videoUrl
      );
      const ext = filename.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? "";
      const fallbackType =
        IssuesService.RECORDING_CONTENT_TYPES[ext] ??
        (filename.includes("-audio") ? "audio/webm" : "video/webm");
      res.setHeader("Content-Type", contentType ?? fallbackType);
      res.setHeader("Accept-Ranges", "bytes");
      this.applySecureDownloadHeaders(res);
      res.send(buffer);
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+\.(webm|mp4|mov|mp3|m4a|ogg|wav)$/i.test(filename)) {
      throw new NotFoundException("Invalid recording filename");
    }
    const filePath = this.storage.resolveLocalUploadPath("recordings", filename);
    if (!existsSync(filePath)) {
      throw new NotFoundException("Recording not found");
    }
    const ext = filename.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? "";
    const contentType =
      IssuesService.RECORDING_CONTENT_TYPES[ext] ??
      (filename.includes("-audio") ? "audio/webm" : "video/webm");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    this.applySecureDownloadHeaders(res);
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

  async streamScreenshotByFilename(
    filename: string,
    res: Response,
    userId?: string
  ): Promise<void> {
    const screenshot = await this.prisma.issueScreenshot.findFirst({
      where: { imageUrl: { endsWith: filename } },
      include: { issue: true },
    });
    if (!screenshot) throw new NotFoundException("Screenshot not found");
    if (userId) {
      await this.verifyIssueBelongsToUser(screenshot.issueId, userId);
    }
    if (this.storage.isFullUrl(screenshot.imageUrl)) {
      const { buffer, contentType } = await this.storage.download(
        screenshot.imageUrl
      );
      const fallbackType =
        this.fileContentTypeFromName(screenshot.imageUrl) || "image/png";
      res.setHeader("Content-Type", contentType ?? fallbackType);
      this.applySecureDownloadHeaders(res);
      res.send(buffer);
      return;
    }
    if (!IssuesService.LOCAL_SCREENSHOT_URL_RE.test(screenshot.imageUrl)) {
      throw new NotFoundException("Screenshot not found");
    }
    const screenshotFilename = screenshot.imageUrl.split("/").pop();
    if (!screenshotFilename) throw new NotFoundException("Screenshot not found");
    const filePath = this.storage.resolveLocalUploadPath(
      "screenshots",
      screenshotFilename
    );
    if (!existsSync(filePath))
      throw new NotFoundException("Screenshot not found");
    res.setHeader(
      "Content-Type",
      this.fileContentTypeFromName(screenshotFilename) || "image/png"
    );
    this.applySecureDownloadHeaders(res);
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
    this.enforceMaxBytes(buffer, MAX_RECORDING_BYTES, "Recording");
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

    await this.recomputeIssueQualityScore(issueId);
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
    await this.recomputeIssueQualityScore(issueId);
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
    await this.recomputeIssueQualityScore(issueId);
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
    this.enforceMaxBytes(buffer, MAX_SCREENSHOT_BYTES, "Screenshot");
    const imageType = this.detectImageType(buffer);
    if (!imageType) {
      throw new BadRequestException(
        "imageBase64 must be a PNG, JPEG, or WEBP image"
      );
    }
    if (userId) await this.verifyIssueBelongsToUser(issueId, userId);
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException("Issue not found");

    const filename = `${issueId}-${Date.now()}.${imageType.extension}`;
    const { url: imageUrl } = await this.storage.upload(
      "screenshots",
      filename,
      buffer,
      imageType.contentType
    );
    const name = fileName?.trim() || null;
    await this.prisma.issueScreenshot.create({
      data: { imageUrl, issueId, name },
    });

    await this.recomputeIssueQualityScore(issueId);
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
      name === undefined
        ? undefined
        : name === null || name.trim() === ""
          ? null
          : name.trim();
    await this.prisma.issueScreenshot.update({
      where: { id: screenshotId },
      data: value === undefined ? {} : { name: value },
    });
    await this.recomputeIssueQualityScore(issueId);
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
    await this.recomputeIssueQualityScore(issueId);
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
    this.enforceMaxBytes(buffer, MAX_FILE_BYTES, "File");
    this.validateUploadableFileName(trimmedName);
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) throw new NotFoundException("Issue not found");

    const ext = trimmedName.includes(".")
      ? trimmedName.replace(/^.*\./, "")
      : "bin";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "bin";
    const filename = `${issueId}-${Date.now()}-${safeExt}`;
    const contentType = this.fileContentTypeFromName(trimmedName);
    const { url: fileUrl } = await this.storage.upload(
      "files",
      filename,
      buffer,
      contentType
    );
    await this.prisma.issueFile.create({
      data: { fileUrl, fileName: trimmedName, issueId },
    });

    await this.recomputeIssueQualityScore(issueId);
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
    await this.recomputeIssueQualityScore(issueId);
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
    const safeName = file.fileName.replace(/[^\w.-]/g, "_");
    const isPdf = /\.pdf$/i.test(file.fileName);
    const contentType = this.fileContentTypeFromName(file.fileName);
    if (this.storage.isFullUrl(file.fileUrl)) {
      const { buffer, contentType: downloadedContentType } =
        await this.storage.download(file.fileUrl);
      res.setHeader(
        "Content-Type",
        downloadedContentType ?? contentType
      );
      res.setHeader(
        "Content-Disposition",
        isPdf
          ? `inline; filename="${safeName}"`
          : `attachment; filename="${safeName}"`
      );
      this.applySecureDownloadHeaders(res);
      res.send(buffer);
      return;
    }
    if (!IssuesService.LOCAL_FILE_URL_RE.test(file.fileUrl)) {
      throw new NotFoundException("File not found");
    }
    const localFileName = file.fileUrl.split("/").pop();
    if (!localFileName) throw new NotFoundException("File not found");
    const filePath = this.storage.resolveLocalUploadPath("files", localFileName);
    if (!existsSync(filePath)) throw new NotFoundException("File not found");
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      isPdf
        ? `inline; filename="${safeName}"`
        : `attachment; filename="${safeName}"`
    );
    this.applySecureDownloadHeaders(res);
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
