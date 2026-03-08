import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt.guard";
import {
  AuthenticatedRequest,
  requireUserId,
} from "../auth/request-user";
import { CodeService } from "./code.service";

@Controller("code")
@UseGuards(JwtAuthGuard)
export class CodeController {
  constructor(private readonly svc: CodeService) {}

  @Get("projects/:projectId/repositories")
  listRepositories(
    @Param("projectId") projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.listRepositoriesForProject(
      projectId,
      requireUserId(req)
    );
  }

  @Post("projects/:projectId/repositories/github")
  createGithubRepository(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      repoFullName?: string;
      defaultBranch?: string;
    },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.createGithubRepositoryForProject(
      projectId,
      requireUserId(req),
      {
        repoFullName: body?.repoFullName,
        defaultBranch: body?.defaultBranch,
      }
    );
  }

  @Get("projects/:projectId/repositories/:repositoryId/analysis/latest")
  getLatestAnalysis(
    @Param("projectId") projectId: string,
    @Param("repositoryId") repositoryId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.getLatestAnalysisRun(
      projectId,
      requireUserId(req),
      repositoryId
    );
  }

  @Post("projects/:projectId/repositories/:repositoryId/analysis")
  saveAnalysis(
    @Param("projectId") projectId: string,
    @Param("repositoryId") repositoryId: string,
    @Body() payload: unknown,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.saveAnalysisRun(
      projectId,
      requireUserId(req),
      repositoryId,
      payload
    );
  }

  @Get("projects/:projectId/prompt-usage/trend")
  getProjectPromptUsageTrend(
    @Param("projectId") projectId: string,
    @Query("source") source: string | undefined,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.getProjectPromptUsageTrend(
      projectId,
      requireUserId(req),
      source
    );
  }

  @Get("projects/:projectId/prompt-usage/mine")
  getMyPromptUsage(
    @Param("projectId") projectId: string,
    @Query("source") source: string | undefined,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.getMyPromptUsage(projectId, requireUserId(req), source);
  }

  @Delete("projects/:projectId/prompt-usage/mine")
  clearMyPromptUsage(
    @Param("projectId") projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.clearMyPromptUsage(projectId, requireUserId(req));
  }

  @Post("projects/:projectId/prompt-optimize")
  optimizePrompt(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      prompt?: string;
    },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.optimizePrompt({
      projectId,
      userId: requireUserId(req),
      prompt: body?.prompt,
    });
  }
}
