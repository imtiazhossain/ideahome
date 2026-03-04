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
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthenticatedRequest, requireUserId } from "../auth/request-user";
import { CalendarService } from "./calendar.service";

@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  private inferBaseFromRequest(req: Request): string | null {
    const forwardedHost = req.header("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || req.header("host")?.trim();
    if (!host) return null;

    const forwardedProto = req
      .header("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .replace(/:$/, "");
    const protocol = (forwardedProto || req.protocol || "https").toLowerCase();
    if (protocol !== "http" && protocol !== "https") return null;

    return `${protocol}://${host}`;
  }

  private inferFrontendBaseFromRequest(req: Request): string | null {
    const origin = req.header("origin")?.trim();
    if (origin) return origin;
    const referer = req.header("referer")?.trim();
    if (referer) {
      try {
        const parsed = new URL(referer);
        return `${parsed.protocol}//${parsed.host}`;
      } catch {
        // Ignore invalid referer header and fall back to host/proto inference.
      }
    }
    return this.inferBaseFromRequest(req);
  }

  @Get("google/status")
  @UseGuards(JwtAuthGuard)
  getGoogleStatus(
    @Query("projectId") projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.calendar.getGoogleStatus(requireUserId(req), projectId.trim());
  }

  @Post("google/connect")
  @UseGuards(JwtAuthGuard)
  connectGoogle(
    @Query("projectId") projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.calendar.getGoogleConnectUrl(requireUserId(req), projectId.trim(), {
      frontendBaseUrl: this.inferFrontendBaseFromRequest(req),
    });
  }

  @Get("google/callback")
  async googleCallback(
    @Query("state") state: string,
    @Query("code") code: string,
    @Query("error") error: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const frontendBaseUrl = this.inferBaseFromRequest(req);
    const redirectUrl = await this.calendar.handleGoogleCallback(
      state ?? "",
      code ?? "",
      {
        frontendBaseUrl,
        oauthError: error ?? "",
      }
    );
    return res.redirect(redirectUrl);
  }

  @Get("google/calendars")
  @UseGuards(JwtAuthGuard)
  listGoogleCalendars(
    @Query("projectId") projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.calendar.listGoogleCalendars(requireUserId(req), projectId.trim());
  }

  @Patch("google/calendar-selection")
  @UseGuards(JwtAuthGuard)
  setGoogleCalendarSelection(
    @Query("projectId") projectId: string,
    @Body() body: { googleCalendarId?: string },
    @Req() req: AuthenticatedRequest
  ) {
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    const googleCalendarId = body?.googleCalendarId?.trim();
    if (!googleCalendarId) {
      throw new BadRequestException("googleCalendarId is required");
    }
    return this.calendar.setGoogleCalendarSelection(
      requireUserId(req),
      projectId.trim(),
      googleCalendarId
    );
  }

  @Post("google/sync")
  @UseGuards(JwtAuthGuard)
  syncGoogle(
    @Query("projectId") projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.calendar.syncGoogleCalendar(requireUserId(req), projectId.trim());
  }

  @Delete("google/connection")
  @UseGuards(JwtAuthGuard)
  disconnectGoogle(
    @Query("projectId") projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.calendar.disconnectGoogleCalendar(requireUserId(req), projectId.trim());
  }

  @Get("events")
  @UseGuards(JwtAuthGuard)
  listEvents(
    @Query("projectId") projectId: string,
    @Query("start") start: string,
    @Query("end") end: string,
    @Req() req: AuthenticatedRequest
  ) {
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.calendar.listEvents(
      requireUserId(req),
      projectId.trim(),
      start ?? "",
      end ?? ""
    );
  }

  @Post("events")
  @UseGuards(JwtAuthGuard)
  createEvent(
    @Query("projectId") projectId: string,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      location?: string | null;
      startAt?: string;
      endAt?: string;
      isAllDay?: boolean;
      timeZone?: string | null;
    },
    @Req() req: AuthenticatedRequest
  ) {
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.calendar.createEvent(requireUserId(req), projectId.trim(), body ?? {});
  }

  @Patch("events/:eventId")
  @UseGuards(JwtAuthGuard)
  updateEvent(
    @Param("eventId") eventId: string,
    @Query("projectId") projectId: string,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      location?: string | null;
      startAt?: string;
      endAt?: string;
      isAllDay?: boolean;
      timeZone?: string | null;
      status?: string;
    },
    @Req() req: AuthenticatedRequest
  ) {
    if (!eventId?.trim()) {
      throw new BadRequestException("eventId is required");
    }
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.calendar.updateEvent(
      requireUserId(req),
      projectId.trim(),
      eventId.trim(),
      body ?? {}
    );
  }

  @Delete("events/:eventId")
  @UseGuards(JwtAuthGuard)
  removeEvent(
    @Param("eventId") eventId: string,
    @Query("projectId") projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    if (!eventId?.trim()) {
      throw new BadRequestException("eventId is required");
    }
    if (!projectId?.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return this.calendar.deleteEvent(requireUserId(req), projectId.trim(), eventId.trim());
  }
}
