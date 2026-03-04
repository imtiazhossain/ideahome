import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { verifyProjectForUser } from "../common/org-scope";
import { PrismaService } from "../prisma.service";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_LIST_URL =
  "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const GOOGLE_CALENDAR_EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_STATE_FUTURE_SKEW_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;
const SYNC_DB_UPSERT_CONCURRENCY = 50;

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

type GoogleCalendarListItem = {
  id?: string;
  summary?: string;
  primary?: boolean;
};

type GoogleEventDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GoogleEvent = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  etag?: string;
  updated?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
};

type GoogleEventsResponse = {
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

type NormalizedGoogleEvent = {
  providerEventId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  isAllDay: boolean;
  timeZone: string | null;
  status: string;
  etag: string | null;
  updatedAtProvider: Date | null;
};

type CreateOrUpdateEventInput = {
  title?: string;
  description?: string | null;
  location?: string | null;
  startAt?: string;
  endAt?: string;
  isAllDay?: boolean;
  timeZone?: string | null;
  status?: string;
};

type CalendarOauthStatePayload = {
  userId: string;
  projectId: string;
  provider: "google";
  iat: number;
  n: string;
  frontendBaseUrl?: string;
};

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private getOAuthStateSecret(): string {
    const explicit = process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET?.trim();
    if (explicit) return explicit;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
    if (clientSecret) return clientSecret;
    const jwtSecret = process.env.JWT_SECRET?.trim();
    if (jwtSecret) return jwtSecret;
    throw new BadRequestException(
      "Google Calendar is not configured. Set GOOGLE_CALENDAR_CLIENT_SECRET or GOOGLE_CALENDAR_OAUTH_STATE_SECRET."
    );
  }

  private getClientId(): string {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
    if (!clientId) {
      throw new BadRequestException(
        "Google Calendar is not configured. Set GOOGLE_CALENDAR_CLIENT_ID."
      );
    }
    return clientId;
  }

  private getClientSecret(): string {
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
    if (!clientSecret) {
      throw new BadRequestException(
        "Google Calendar is not configured. Set GOOGLE_CALENDAR_CLIENT_SECRET."
      );
    }
    return clientSecret;
  }

  private getRedirectUri(): string {
    const explicit = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
    if (explicit) return explicit;
    const backendBase = (process.env.BACKEND_URL ?? "http://localhost:3001").replace(
      /\/$/,
      ""
    );
    return `${backendBase}/calendar/google/callback`;
  }

  private getFrontendCalendarUrl(
    projectId?: string,
    frontendBaseOverride?: string | null
  ): string {
    const override = frontendBaseOverride?.trim();
    const normalizedOverride = override
      ? (() => {
          try {
            const parsed = new URL(override);
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
              return "";
            }
            return parsed.toString().replace(/\/$/, "");
          } catch {
            return "";
          }
        })()
      : "";
    const frontendBase = (
      normalizedOverride ||
      process.env.FRONTEND_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    ).replace(/\/$/, "");
    const url = new URL("/calendar", frontendBase);
    if (projectId) url.searchParams.set("projectId", projectId);
    return url.toString();
  }

  private getEncryptionKey(): Buffer {
    const raw = process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY?.trim();
    if (!raw) {
      throw new BadRequestException(
        "Missing GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY configuration"
      );
    }
    let key: Buffer;
    try {
      key = Buffer.from(raw, "base64");
    } catch {
      throw new BadRequestException(
        "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY must be valid base64"
      );
    }
    if (key.length !== 32) {
      throw new BadRequestException(
        "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY must decode to 32 bytes"
      );
    }
    return key;
  }

  private encrypt(value: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
  }

  private decrypt(value: string): string {
    const [ivB64, tagB64, payloadB64] = value.split(".");
    if (!ivB64 || !tagB64 || !payloadB64) {
      throw new BadRequestException("Invalid encrypted token payload");
    }
    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const payload = Buffer.from(payloadB64, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(payload),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }

  private signState(payload: CalendarOauthStatePayload): string {
    const payloadStr = JSON.stringify(payload);
    const b64 = Buffer.from(payloadStr, "utf8").toString("base64url");
    const sig = crypto
      .createHmac("sha256", this.getOAuthStateSecret())
      .update(payloadStr)
      .digest("base64url");
    return `${b64}.${sig}`;
  }

  private consumeState(state: string): {
    userId: string;
    projectId: string;
    provider: "google";
    frontendBaseUrl: string | null;
  } | null {
    const safeState = typeof state === "string" ? state.trim() : "";
    if (!safeState) return null;
    const dot = safeState.lastIndexOf(".");
    if (dot < 0) return null;
    const payloadB64 = safeState.slice(0, dot);
    const sig = safeState.slice(dot + 1);
    let payloadRaw = "";
    try {
      payloadRaw = Buffer.from(payloadB64, "base64url").toString("utf8");
    } catch {
      return null;
    }
    const expected = crypto
      .createHmac("sha256", this.getOAuthStateSecret())
      .update(payloadRaw)
      .digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return null;
    }
    let parsed: Partial<CalendarOauthStatePayload>;
    try {
      parsed = JSON.parse(payloadRaw) as Partial<CalendarOauthStatePayload>;
    } catch {
      return null;
    }
    const frontendBaseUrl =
      typeof parsed.frontendBaseUrl === "string" ? parsed.frontendBaseUrl.trim() : "";
    const normalizedFrontendBaseUrl = frontendBaseUrl
      ? (() => {
          try {
            const parsedUrl = new URL(frontendBaseUrl);
            if (
              parsedUrl.protocol !== "http:" &&
              parsedUrl.protocol !== "https:"
            ) {
              return "";
            }
            return `${parsedUrl.protocol}//${parsedUrl.host}`;
          } catch {
            return "";
          }
        })()
      : "";
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.projectId !== "string" ||
      parsed.provider !== "google" ||
      typeof parsed.iat !== "number" ||
      parsed.iat > Date.now() + OAUTH_STATE_FUTURE_SKEW_MS ||
      Date.now() - parsed.iat > OAUTH_STATE_TTL_MS
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      projectId: parsed.projectId,
      provider: "google",
      frontendBaseUrl: normalizedFrontendBaseUrl || null,
    };
  }

  private async fetchWithTimeout(
    input: string,
    init?: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new BadRequestException("Google API request timed out");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async verifyProjectAccess(projectId: string, userId: string) {
    await verifyProjectForUser(this.prisma, projectId, userId);
  }

  private async exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
    const body = new URLSearchParams({
      code,
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      redirect_uri: this.getRedirectUri(),
      grant_type: "authorization_code",
    });
    const response = await this.fetchWithTimeout(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new BadRequestException("Failed to exchange Google Calendar OAuth code");
    }
    return (await response.json()) as GoogleTokenResponse;
  }

  private async refreshAccessToken(connectionId: string, refreshToken: string) {
    const body = new URLSearchParams({
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const response = await this.fetchWithTimeout(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new ForbiddenException("Google token refresh failed; reconnect required");
    }
    const token = (await response.json()) as GoogleTokenResponse;
    if (!token.access_token) {
      throw new ForbiddenException("Google token refresh failed; reconnect required");
    }
    const tokenExpiresAt =
      typeof token.expires_in === "number"
        ? new Date(Date.now() + token.expires_in * 1000)
        : null;
    await this.prisma.calendarConnection.update({
      where: { id: connectionId },
      data: {
        encryptedAccessToken: this.encrypt(token.access_token),
        ...(token.refresh_token
          ? { encryptedRefreshToken: this.encrypt(token.refresh_token) }
          : {}),
        tokenExpiresAt,
      },
    });
    return {
      accessToken: token.access_token,
      expiresAt: tokenExpiresAt,
    };
  }

  private async getConnectionWithToken(userId: string, projectId: string) {
    await this.verifyProjectAccess(projectId, userId);
    const connection = await this.prisma.calendarConnection.findFirst({
      where: {
        userId,
        projectId,
        provider: "google",
      },
    });
    if (!connection) {
      throw new NotFoundException("Google Calendar is not connected for this project");
    }

    const refreshToken = this.decrypt(connection.encryptedRefreshToken);
    let accessToken = this.decrypt(connection.encryptedAccessToken);

    if (
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt.getTime() < Date.now() + 30_000
    ) {
      const refreshed = await this.refreshAccessToken(connection.id, refreshToken);
      accessToken = refreshed.accessToken;
    }

    return {
      connection,
      accessToken,
      refreshToken,
    };
  }

  private async googleRequest<T>(
    accessToken: string,
    url: string,
    init?: RequestInit,
    allowNotFound = false
  ): Promise<T> {
    const response = await this.fetchWithTimeout(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (allowNotFound && response.status === 404) {
      return null as T;
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ForbiddenException("Google Calendar authorization failed");
      }
      if (response.status === 410) {
        throw new BadRequestException("GOOGLE_SYNC_TOKEN_INVALID");
      }
      const text = await response.text();
      throw new BadRequestException(
        text.trim() || `Google Calendar request failed (${response.status})`
      );
    }
    return (await response.json()) as T;
  }

  private parseGoogleEventDate(
    value: GoogleEventDateTime | undefined,
    fallbackTimeZone: string
  ): { at: Date; isAllDay: boolean; timeZone: string | null } {
    if (value?.dateTime) {
      return {
        at: new Date(value.dateTime),
        isAllDay: false,
        timeZone: value.timeZone ?? fallbackTimeZone ?? null,
      };
    }
    if (value?.date) {
      return {
        at: new Date(`${value.date}T00:00:00.000Z`),
        isAllDay: true,
        timeZone: value.timeZone ?? fallbackTimeZone ?? "UTC",
      };
    }
    return {
      at: new Date(),
      isAllDay: false,
      timeZone: fallbackTimeZone || null,
    };
  }

  private normalizeGoogleEvent(
    event: GoogleEvent,
    fallbackTimeZone: string
  ): NormalizedGoogleEvent {
    const start = this.parseGoogleEventDate(event.start, fallbackTimeZone);
    const end = this.parseGoogleEventDate(event.end, fallbackTimeZone);
    return {
      providerEventId: event.id ?? "",
      title: event.summary?.trim() || "Untitled event",
      description: event.description?.trim() || null,
      location: event.location?.trim() || null,
      startAt: start.at,
      endAt: end.at,
      isAllDay: start.isAllDay,
      timeZone: start.timeZone,
      status: event.status?.trim() || "confirmed",
      etag: event.etag?.trim() || null,
      updatedAtProvider: event.updated ? new Date(event.updated) : null,
    };
  }

  private chunkArray<T>(items: T[], chunkSize: number): T[][] {
    if (chunkSize <= 0) return [items];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private toGoogleEventPayload(input: CreateOrUpdateEventInput): Record<string, unknown> {
    const title = input.title?.trim();
    if (!title) {
      throw new BadRequestException("title is required");
    }
    if (!input.startAt || !input.endAt) {
      throw new BadRequestException("startAt and endAt are required");
    }
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException("startAt and endAt must be valid ISO datetime strings");
    }
    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException("endAt must be after startAt");
    }
    const timeZone = input.timeZone?.trim() || "UTC";
    const payload: Record<string, unknown> = {
      summary: title,
      description: input.description?.trim() || undefined,
      location: input.location?.trim() || undefined,
      status: input.status?.trim() || "confirmed",
    };
    if (input.isAllDay) {
      const endDateExclusive = new Date(endAt);
      endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);
      payload.start = { date: startAt.toISOString().slice(0, 10) };
      payload.end = { date: endDateExclusive.toISOString().slice(0, 10) };
    } else {
      payload.start = {
        dateTime: startAt.toISOString(),
        timeZone,
      };
      payload.end = {
        dateTime: endAt.toISOString(),
        timeZone,
      };
    }
    return payload;
  }

  async getGoogleConnectUrl(
    userId: string,
    projectId: string,
    options?: { frontendBaseUrl?: string | null }
  ): Promise<{ url: string }> {
    await this.verifyProjectAccess(projectId, userId);
    const frontendBase = options?.frontendBaseUrl?.trim();
    const state = this.signState({
      userId,
      projectId,
      provider: "google",
      iat: Date.now(),
      n: crypto.randomBytes(8).toString("hex"),
      ...(frontendBase ? { frontendBaseUrl: frontendBase } : {}),
    });
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", this.getClientId());
    url.searchParams.set("redirect_uri", this.getRedirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return { url: url.toString() };
  }

  async handleGoogleCallback(
    state: string,
    code: string,
    options?: { frontendBaseUrl?: string | null; oauthError?: string }
  ): Promise<string> {
    const consumed = this.consumeState(state);
    if (!consumed || !code?.trim()) {
      const redirect = new URL(
        this.getFrontendCalendarUrl(undefined, options?.frontendBaseUrl ?? null)
      );
      const oauthError = options?.oauthError?.trim();
      redirect.searchParams.set("google_error", oauthError || "invalid_callback");
      return redirect.toString();
    }
    const { userId, projectId, frontendBaseUrl } = consumed;
    const redirectBase = frontendBaseUrl ?? options?.frontendBaseUrl ?? null;
    await this.verifyProjectAccess(projectId, userId);

    try {
      const token = await this.exchangeCodeForTokens(code.trim());
      if (!token.access_token || !token.refresh_token) {
        const redirect = new URL(
          this.getFrontendCalendarUrl(projectId, redirectBase)
        );
        redirect.searchParams.set("google_error", "missing_tokens");
        redirect.searchParams.set("projectId", projectId);
        return redirect.toString();
      }

      const calendars = await this.googleRequest<{ items?: GoogleCalendarListItem[] }>(
        token.access_token,
        GOOGLE_CALENDAR_LIST_URL
      );
      const selectedCalendarId =
        calendars.items?.find((item) => item.primary && item.id)?.id ||
        calendars.items?.[0]?.id ||
        "primary";

      const tokenExpiresAt =
        typeof token.expires_in === "number"
          ? new Date(Date.now() + token.expires_in * 1000)
          : null;

      await this.prisma.calendarConnection.upsert({
        where: {
          userId_projectId_provider: {
            userId,
            projectId,
            provider: "google",
          },
        },
        create: {
          userId,
          projectId,
          provider: "google",
          googleCalendarId: selectedCalendarId,
          encryptedAccessToken: this.encrypt(token.access_token),
          encryptedRefreshToken: this.encrypt(token.refresh_token),
          tokenExpiresAt,
        },
        update: {
          googleCalendarId: selectedCalendarId,
          encryptedAccessToken: this.encrypt(token.access_token),
          encryptedRefreshToken: this.encrypt(token.refresh_token),
          tokenExpiresAt,
          syncToken: null,
        },
      });

      const redirect = new URL(
        this.getFrontendCalendarUrl(projectId, redirectBase)
      );
      redirect.searchParams.set("google_connected", "1");
      redirect.searchParams.set("projectId", projectId);
      return redirect.toString();
    } catch {
      const redirect = new URL(
        this.getFrontendCalendarUrl(projectId, redirectBase)
      );
      redirect.searchParams.set("google_error", "oauth_failed");
      redirect.searchParams.set("projectId", projectId);
      return redirect.toString();
    }
  }

  async getGoogleStatus(userId: string, projectId: string) {
    await this.verifyProjectAccess(projectId, userId);
    const connection = await this.prisma.calendarConnection.findFirst({
      where: { userId, projectId, provider: "google" },
      select: {
        id: true,
        googleCalendarId: true,
        lastSyncedAt: true,
        updatedAt: true,
      },
    });
    return {
      connected: Boolean(connection),
      selectedCalendarId: connection?.googleCalendarId ?? null,
      lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
      connectedAt: connection?.updatedAt?.toISOString() ?? null,
    };
  }

  async listGoogleCalendars(userId: string, projectId: string) {
    const { accessToken } = await this.getConnectionWithToken(userId, projectId);
    const result = await this.googleRequest<{ items?: GoogleCalendarListItem[] }>(
      accessToken,
      GOOGLE_CALENDAR_LIST_URL
    );
    return (result.items ?? [])
      .filter((item) => item.id)
      .map((item) => ({
        id: item.id as string,
        summary: item.summary?.trim() || item.id,
        primary: item.primary === true,
      }));
  }

  async setGoogleCalendarSelection(
    userId: string,
    projectId: string,
    googleCalendarId: string
  ) {
    const { connection } = await this.getConnectionWithToken(userId, projectId);
    const updated = await this.prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        googleCalendarId,
        syncToken: null,
      },
      select: {
        googleCalendarId: true,
      },
    });
    return { selectedCalendarId: updated.googleCalendarId };
  }

  async disconnectGoogleCalendar(userId: string, projectId: string) {
    await this.verifyProjectAccess(projectId, userId);
    await this.prisma.calendarConnection.deleteMany({
      where: {
        userId,
        projectId,
        provider: "google",
      },
    });
    await this.prisma.calendarEvent.deleteMany({
      where: {
        userId,
        projectId,
        provider: "google",
      },
    });
    return { disconnected: true };
  }

  private async syncInternal(
    connectionId: string,
    userId: string,
    projectId: string,
    accessToken: string,
    googleCalendarId: string,
    previousSyncToken: string | null
  ): Promise<{ upserted: number; deleted: number; syncToken: string | null }> {
    let pageToken: string | undefined;
    let syncToken = previousSyncToken ?? undefined;
    let upserted = 0;
    let deleted = 0;
    let nextSyncToken: string | null = null;

    do {
      const url = new URL(
        `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(googleCalendarId)}/events`
      );
      url.searchParams.set("maxResults", "2500");
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("showDeleted", "true");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }
      if (syncToken) {
        url.searchParams.set("syncToken", syncToken);
      } else {
        const timeMin = new Date();
        timeMin.setMonth(timeMin.getMonth() - 6);
        const timeMax = new Date();
        timeMax.setMonth(timeMax.getMonth() + 18);
        url.searchParams.set("timeMin", timeMin.toISOString());
        url.searchParams.set("timeMax", timeMax.toISOString());
      }

      const response = await this.googleRequest<GoogleEventsResponse>(
        accessToken,
        url.toString()
      );

      const cancelledEventIds = new Set<string>();
      const normalizedByProviderEventId = new Map<string, NormalizedGoogleEvent>();
      for (const event of response.items ?? []) {
        if (!event.id) continue;
        if (event.status === "cancelled") {
          cancelledEventIds.add(event.id);
          normalizedByProviderEventId.delete(event.id);
          continue;
        }
        const normalized = this.normalizeGoogleEvent(event, "UTC");
        if (!normalized.providerEventId) continue;
        normalizedByProviderEventId.set(normalized.providerEventId, normalized);
        cancelledEventIds.delete(normalized.providerEventId);
      }

      if (cancelledEventIds.size > 0) {
        const removed = await this.prisma.calendarEvent.deleteMany({
          where: {
            userId,
            projectId,
            provider: "google",
            providerEventId: { in: [...cancelledEventIds] },
          },
        });
        deleted += removed.count;
      }

      const normalizedEvents = [...normalizedByProviderEventId.values()];
      const syncedAt = new Date();
      for (const chunk of this.chunkArray(
        normalizedEvents,
        SYNC_DB_UPSERT_CONCURRENCY
      )) {
        await Promise.all(
          chunk.map((normalized) =>
            this.prisma.calendarEvent.upsert({
              where: {
                projectId_provider_providerEventId: {
                  projectId,
                  provider: "google",
                  providerEventId: normalized.providerEventId,
                },
              },
              create: {
                projectId,
                userId,
                provider: "google",
                providerEventId: normalized.providerEventId,
                title: normalized.title,
                description: normalized.description,
                location: normalized.location,
                startAt: normalized.startAt,
                endAt: normalized.endAt,
                isAllDay: normalized.isAllDay,
                timeZone: normalized.timeZone,
                status: normalized.status,
                etag: normalized.etag,
                updatedAtProvider: normalized.updatedAtProvider,
                lastSyncedAt: syncedAt,
              },
              update: {
                title: normalized.title,
                description: normalized.description,
                location: normalized.location,
                startAt: normalized.startAt,
                endAt: normalized.endAt,
                isAllDay: normalized.isAllDay,
                timeZone: normalized.timeZone,
                status: normalized.status,
                etag: normalized.etag,
                updatedAtProvider: normalized.updatedAtProvider,
                lastSyncedAt: syncedAt,
              },
            })
          )
        );
      }
      upserted += normalizedEvents.length;

      pageToken = response.nextPageToken;
      if (response.nextSyncToken) {
        nextSyncToken = response.nextSyncToken;
      }
    } while (pageToken);

    await this.prisma.calendarConnection.update({
      where: { id: connectionId },
      data: {
        syncToken: nextSyncToken,
        lastSyncedAt: new Date(),
      },
    });

    return {
      upserted,
      deleted,
      syncToken: nextSyncToken,
    };
  }

  async syncGoogleCalendar(userId: string, projectId: string) {
    const { connection, accessToken } = await this.getConnectionWithToken(
      userId,
      projectId
    );

    try {
      const result = await this.syncInternal(
        connection.id,
        userId,
        projectId,
        accessToken,
        connection.googleCalendarId,
        connection.syncToken
      );
      return {
        upserted: result.upserted,
        deleted: result.deleted,
        lastSyncedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (
        err instanceof BadRequestException &&
        String(err.message).includes("GOOGLE_SYNC_TOKEN_INVALID")
      ) {
        await this.prisma.calendarConnection.update({
          where: { id: connection.id },
          data: { syncToken: null },
        });
        const full = await this.syncInternal(
          connection.id,
          userId,
          projectId,
          accessToken,
          connection.googleCalendarId,
          null
        );
        return {
          upserted: full.upserted,
          deleted: full.deleted,
          lastSyncedAt: new Date().toISOString(),
          fullResync: true,
        };
      }
      throw err;
    }
  }

  async listEvents(userId: string, projectId: string, start: string, end: string) {
    await this.verifyProjectAccess(projectId, userId);
    const startAt = start ? new Date(start) : new Date(new Date().setDate(1));
    const endAt = end
      ? new Date(end)
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException("start and end must be valid ISO datetime values");
    }

    const events = await this.prisma.calendarEvent.findMany({
      where: {
        userId,
        projectId,
        startAt: { lte: endAt },
        endAt: { gte: startAt },
      },
      orderBy: { startAt: "asc" },
    });

    return events.map((event) => ({
      id: event.id,
      provider: event.provider,
      providerEventId: event.providerEventId,
      title: event.title,
      description: event.description,
      location: event.location,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      isAllDay: event.isAllDay,
      timeZone: event.timeZone,
      status: event.status,
      etag: event.etag,
      updatedAtProvider: event.updatedAtProvider?.toISOString() ?? null,
      lastSyncedAt: event.lastSyncedAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    }));
  }

  async createEvent(userId: string, projectId: string, input: CreateOrUpdateEventInput) {
    const { connection, accessToken } = await this.getConnectionWithToken(userId, projectId);
    const payload = this.toGoogleEventPayload(input);
    const url = `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(connection.googleCalendarId)}/events`;
    const created = await this.googleRequest<GoogleEvent>(accessToken, url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!created.id) {
      throw new BadRequestException("Google did not return an event id");
    }
    const normalized = this.normalizeGoogleEvent(created, "UTC");
    const local = await this.prisma.calendarEvent.create({
      data: {
        userId,
        projectId,
        provider: "google",
        providerEventId: normalized.providerEventId,
        title: normalized.title,
        description: normalized.description,
        location: normalized.location,
        startAt: normalized.startAt,
        endAt: normalized.endAt,
        isAllDay: normalized.isAllDay,
        timeZone: normalized.timeZone,
        status: normalized.status,
        etag: normalized.etag,
        updatedAtProvider: normalized.updatedAtProvider,
        lastSyncedAt: new Date(),
      },
    });
    return {
      id: local.id,
      provider: local.provider,
      providerEventId: local.providerEventId,
      title: local.title,
      description: local.description,
      location: local.location,
      startAt: local.startAt.toISOString(),
      endAt: local.endAt.toISOString(),
      isAllDay: local.isAllDay,
      timeZone: local.timeZone,
      status: local.status,
      etag: local.etag,
      updatedAtProvider: local.updatedAtProvider?.toISOString() ?? null,
      lastSyncedAt: local.lastSyncedAt?.toISOString() ?? null,
      createdAt: local.createdAt.toISOString(),
      updatedAt: local.updatedAt.toISOString(),
    };
  }

  async updateEvent(
    userId: string,
    projectId: string,
    eventId: string,
    input: CreateOrUpdateEventInput
  ) {
    const { connection, accessToken } = await this.getConnectionWithToken(userId, projectId);
    const existing = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, userId, projectId },
    });
    if (!existing) {
      throw new NotFoundException("Calendar event not found");
    }

    const payload = this.toGoogleEventPayload({
      title: input.title ?? existing.title,
      description:
        input.description !== undefined ? input.description : existing.description,
      location: input.location !== undefined ? input.location : existing.location,
      startAt: input.startAt ?? existing.startAt.toISOString(),
      endAt: input.endAt ?? existing.endAt.toISOString(),
      isAllDay: input.isAllDay ?? existing.isAllDay,
      timeZone: input.timeZone ?? existing.timeZone,
      status: input.status ?? existing.status,
    });
    const url = `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(connection.googleCalendarId)}/events/${encodeURIComponent(existing.providerEventId)}`;
    const updatedRemote = await this.googleRequest<GoogleEvent>(accessToken, url, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    const normalized = this.normalizeGoogleEvent(updatedRemote, "UTC");
    const updated = await this.prisma.calendarEvent.update({
      where: { id: existing.id },
      data: {
        title: normalized.title,
        description: normalized.description,
        location: normalized.location,
        startAt: normalized.startAt,
        endAt: normalized.endAt,
        isAllDay: normalized.isAllDay,
        timeZone: normalized.timeZone,
        status: normalized.status,
        etag: normalized.etag,
        updatedAtProvider: normalized.updatedAtProvider,
        lastSyncedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      provider: updated.provider,
      providerEventId: updated.providerEventId,
      title: updated.title,
      description: updated.description,
      location: updated.location,
      startAt: updated.startAt.toISOString(),
      endAt: updated.endAt.toISOString(),
      isAllDay: updated.isAllDay,
      timeZone: updated.timeZone,
      status: updated.status,
      etag: updated.etag,
      updatedAtProvider: updated.updatedAtProvider?.toISOString() ?? null,
      lastSyncedAt: updated.lastSyncedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteEvent(userId: string, projectId: string, eventId: string) {
    const { connection, accessToken } = await this.getConnectionWithToken(userId, projectId);
    const existing = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, userId, projectId },
    });
    if (!existing) {
      throw new NotFoundException("Calendar event not found");
    }

    const url = `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(connection.googleCalendarId)}/events/${encodeURIComponent(existing.providerEventId)}`;
    await this.fetchWithTimeout(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    await this.prisma.calendarEvent.delete({ where: { id: existing.id } });
    return { deleted: true };
  }
}
