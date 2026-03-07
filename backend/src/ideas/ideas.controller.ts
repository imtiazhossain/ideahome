import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthenticatedRequest, requireUserId } from "../auth/request-user";
import { IdeasService } from "./ideas.service";

@Controller("ideas")
@UseGuards(JwtAuthGuard)
export class IdeasController {
  private readonly maxContextLength = 4000;
  private readonly maxModelLength = 120;
  private readonly maxItemNameLength = 240;

  constructor(private readonly svc: IdeasService) {}

  @Get("weather")
  getCurrentWeather(
    @Query("location") location: string | undefined,
    @Query("latitude") latitudeRaw: string | undefined,
    @Query("longitude") longitudeRaw: string | undefined,
    @Req() req: AuthenticatedRequest
  ) {
    requireUserId(req);
    const locationTrimmed = (location ?? "").trim();
    if (locationTrimmed) {
      return this.svc.getWeatherByCity(locationTrimmed);
    }
    return this.svc.getCurrentWeather(
      this.normalizeCoordinate(latitudeRaw, "latitude"),
      this.normalizeCoordinate(longitudeRaw, "longitude")
    );
  }

  @Get("openrouter-models")
  listOpenRouterModels(@Req() req: AuthenticatedRequest) {
    requireUserId(req);
    return this.svc.listOpenRouterModels(req.user?.email);
  }

  @Get("web-search")
  searchWeb(
    @Query("q") query: string | undefined,
    @Query("limit") limitRaw: string | undefined,
    @Req() req: AuthenticatedRequest
  ) {
    requireUserId(req);
    const limit = Number(limitRaw);
    return this.svc.searchWeb(
      (query ?? "").trim(),
      Number.isFinite(limit) ? limit : undefined
    );
  }

  @Get()
  list(
    @Query("projectId") projectId: string,
    @Query("search") search: string | undefined,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.list(projectId, requireUserId(req), search);
  }

  @Get("elevenlabs-voices")
  listElevenLabsVoices(@Req() req: AuthenticatedRequest) {
    requireUserId(req);
    return this.svc.listElevenLabsVoices();
  }

  @Post("tts")
  async synthesizeTts(
    @Body() body: { text?: string; voiceId?: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    requireUserId(req);
    const buffer = await this.svc.synthesizeElevenLabsSpeech(
      (body?.text ?? "").trim(),
      body?.voiceId
    );
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  }

  @Post()
  create(
    @Body() body: { projectId: string; name: string; done?: boolean },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.create(requireUserId(req), body ?? {});
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: { name?: string; done?: boolean; order?: number },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.update(id, requireUserId(req), body ?? {});
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.svc.remove(id, requireUserId(req));
  }

  @Post("reorder")
  reorder(
    @Body() body: { projectId: string; ideaIds: string[] },
    @Req() req: AuthenticatedRequest
  ) {
    const payload = body ?? {};
    return this.svc.reorder(
      payload.projectId,
      requireUserId(req),
      payload.ideaIds
    );
  }

  @Post(":id/plan")
  generatePlan(
    @Param("id") id: string,
    @Body() body: { context?: string; model?: string },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.generatePlan(
      id,
      requireUserId(req),
      this.normalizeContext(body?.context),
      this.normalizeModel(body?.model),
      req.user?.email
    );
  }

  @Post(":id/assistant-chat")
  generateAssistantChat(
    @Param("id") id: string,
    @Body() body: { context?: string; model?: string; includeWeb?: boolean },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.generateAssistantChat(
      id,
      requireUserId(req),
      this.normalizeContext(body?.context),
      this.normalizeModel(body?.model),
      req.user?.email,
      this.normalizeBoolean(body?.includeWeb)
    );
  }

  @Post("assistant-chat")
  generateListAssistantChat(
    @Body()
    body: {
      projectId?: string;
      itemName?: string;
      context?: string;
      model?: string;
      includeWeb?: boolean;
    },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.generateListAssistantChat(
      this.normalizeProjectId(body?.projectId),
      requireUserId(req),
      this.normalizeItemName(body?.itemName),
      this.normalizeContext(body?.context),
      this.normalizeModel(body?.model),
      req.user?.email,
      this.normalizeBoolean(body?.includeWeb)
    );
  }

  private normalizeContext(context?: string): string | undefined {
    if (typeof context !== "string") return undefined;
    const trimmed = context.trim();
    if (!trimmed) return undefined;
    // Preserve the newest turns because the client appends the latest prompt at the end.
    return trimmed.slice(-this.maxContextLength);
  }

  private normalizeModel(model?: string): string | undefined {
    if (typeof model !== "string") return undefined;
    const trimmed = model.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, this.maxModelLength);
  }

  private normalizeBoolean(value: unknown): boolean | undefined {
    if (typeof value !== "boolean") return undefined;
    return value;
  }

  private normalizeProjectId(projectId?: string): string {
    if (typeof projectId !== "string") return "";
    return projectId.trim();
  }

  private normalizeItemName(itemName?: string): string {
    if (typeof itemName !== "string") return "";
    return itemName.trim().slice(0, this.maxItemNameLength);
  }

  private normalizeCoordinate(
    raw: string | undefined,
    label: "latitude" | "longitude"
  ): number {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new BadRequestException(`${label} is required`);
    }
    return value;
  }
}
