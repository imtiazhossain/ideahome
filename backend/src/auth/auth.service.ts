import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma.service";
import { getJwtSecret } from "./jwt-secret";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const STATE_FUTURE_SKEW_MS = 60 * 1000; // 1 minute
const OAUTH_FETCH_TIMEOUT_MS = 15_000;
const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_KEYS_CACHE_TTL_MS = 60 * 60 * 1000;

async function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OAUTH_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("OAuth request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export type SsoProfile = {
  providerId: string;
  email: string;
  name?: string | null;
};

async function postForm(
  url: string,
  body: Record<string, string>,
  headers: Record<string, string> = {}
): Promise<Record<string, unknown>> {
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token error: ${res.status} ${text}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

@Injectable()
export class AuthService {
  private applePublicKeysByKid: Record<string, string> | null = null;
  private applePublicKeysExpiresAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  getRedirectUri(provider: "google" | "github" | "apple"): string {
    const base = process.env.BACKEND_URL ?? "http://localhost:3001";
    return `${base}/auth/${provider}/callback`;
  }

  private getFrontendBaseUrl(): string {
    const base =
      process.env.FRONTEND_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    return base.replace(/\/$/, "");
  }

  private appendHashParams(baseUrl: string, params: Record<string, string>): string {
    const hashParams = new URLSearchParams(params);
    const hash = hashParams.toString();
    if (!hash) return baseUrl;
    const joiner = baseUrl.includes("#") ? "&" : "#";
    return `${baseUrl}${joiner}${hash}`;
  }

  private appendQueryParams(baseUrl: string, params: Record<string, string>): string {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (!value) return;
      url.searchParams.set(key, value);
    });
    return url.toString();
  }

  private isAllowedMobileRedirectUri(redirectUri: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(redirectUri);
    } catch {
      return false;
    }
    const allowedSchemesRaw =
      process.env.MOBILE_AUTH_REDIRECT_SCHEMES ?? "ideahome";
    const allowedSchemes = allowedSchemesRaw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    return allowedSchemes.includes(parsed.protocol.replace(":", "").toLowerCase());
  }

  normalizeMobileRedirectUri(redirectUri?: string): string | null {
    const fallback = process.env.MOBILE_AUTH_REDIRECT_URI ?? "ideahome://auth";
    const candidate = (redirectUri ?? fallback).trim();
    if (!candidate) return null;
    if (!this.isAllowedMobileRedirectUri(candidate)) return null;
    return candidate;
  }

  getFrontendCallbackUrl(token: string, mobileRedirectUri?: string | null): string {
    if (mobileRedirectUri) {
      const mobileCallbackUrl = `${this.getFrontendBaseUrl()}/mobile/auth/callback`;
      return this.appendQueryParams(mobileCallbackUrl, {
        redirect_uri: mobileRedirectUri,
        token,
      });
    }
    const baseUrl = `${this.getFrontendBaseUrl()}/login/callback`;
    return token ? this.appendHashParams(baseUrl, { token }) : baseUrl;
  }

  getErrorRedirectUrl(error: string, mobileRedirectUri?: string | null): string {
    if (mobileRedirectUri) {
      const mobileCallbackUrl = `${this.getFrontendBaseUrl()}/mobile/auth/callback`;
      return this.appendQueryParams(mobileCallbackUrl, {
        redirect_uri: mobileRedirectUri,
        error,
      });
    }
    return this.appendHashParams(this.getFrontendCallbackUrl(""), { error });
  }

  createState(
    provider: "google" | "github" | "apple",
    mobileRedirectUri?: string | null
  ): string {
    const payload = {
      p: provider,
      iat: Date.now(),
      n: crypto.randomBytes(8).toString("hex"),
      ...(mobileRedirectUri ? { mr: mobileRedirectUri } : {}),
    };
    const payloadStr = JSON.stringify(payload);
    const b64 = Buffer.from(payloadStr, "utf8").toString("base64url");
    const sig = crypto
      .createHmac("sha256", getJwtSecret())
      .update(payloadStr)
      .digest("base64url");
    return `${b64}.${sig}`;
  }

  consumeState(
    state: string
  ): { provider: "google" | "github" | "apple"; mobileRedirectUri: string | null } | null {
    if (!state || typeof state !== "string") return null;
    const dot = state.lastIndexOf(".");
    if (dot === -1) return null;
    const b64 = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    let payloadStr: string;
    try {
      payloadStr = Buffer.from(b64, "base64url").toString("utf8");
    } catch {
      return null;
    }
    const expectedSig = crypto
      .createHmac("sha256", getJwtSecret())
      .update(payloadStr)
      .digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return null;
    }
    let payload: { p?: string; iat?: number; mr?: string };
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      return null;
    }
    if (
      payload.p !== "google" &&
      payload.p !== "github" &&
      payload.p !== "apple"
    )
      return null;
    if (
      typeof payload.iat !== "number" ||
      payload.iat > Date.now() + STATE_FUTURE_SKEW_MS ||
      Date.now() - payload.iat > STATE_TTL_MS
    )
      return null;
    const mobileRedirectUri =
      typeof payload.mr === "string" && this.isAllowedMobileRedirectUri(payload.mr)
        ? payload.mr
        : null;
    return { provider: payload.p, mobileRedirectUri };
  }

  /** Ensures the user has a personal organization (for user-scoped projects). Returns the user with organizationId set. */
  async ensureUserOrganization(userId: string): Promise<{
    id: string;
    email: string;
    name: string | null;
    organizationId: string | null;
  }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, organizationId: true },
    });
    if (user.organizationId) {
      await this.prisma.organizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: user.organizationId,
            userId: user.id,
          },
        },
        create: {
          organizationId: user.organizationId,
          userId: user.id,
          role: "MEMBER",
        },
        update: {},
      });
      return user;
    }
    const org = await this.prisma.organization.create({
      data: { name: "My Workspace" },
    });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { organizationId: org.id },
      }),
      this.prisma.organizationMembership.create({
        data: {
          organizationId: org.id,
          userId,
          role: "OWNER",
        },
      }),
    ]);
    return { ...user, organizationId: org.id };
  }

  async ensureOrganizationMembership(
    organizationId: string,
    userId: string,
    role: "OWNER" | "MEMBER" = "MEMBER"
  ): Promise<void> {
    await this.prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      create: {
        organizationId,
        userId,
        role,
      },
      update: {},
    });
  }

  private async acceptPendingProjectInvitesByEmail(
    userId: string,
    email: string
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    const pendingInvites = await this.prisma.projectInvite.findMany({
      where: { email: normalizedEmail, acceptedAt: null },
      select: {
        id: true,
        projectId: true,
        project: { select: { organizationId: true } },
      },
    });
    if (pendingInvites.length === 0) return;

    for (const invite of pendingInvites) {
      await this.ensureOrganizationMembership(
        invite.project.organizationId,
        userId,
        "MEMBER"
      );
      await this.prisma.projectMembership.upsert({
        where: {
          projectId_userId: {
            projectId: invite.projectId,
            userId,
          },
        },
        create: {
          projectId: invite.projectId,
          userId,
          role: "MEMBER",
        },
        update: {},
      });
      await this.prisma.projectInvite.update({
        where: { id: invite.id },
        data: {
          acceptedByUserId: userId,
          acceptedAt: new Date(),
        },
      });
    }
  }

  async findOrCreateUserByFirebase(
    uid: string,
    email: string,
    name?: string | null
  ): Promise<{ id: string; email: string; name: string | null }> {
    const profile: SsoProfile = {
      providerId: uid,
      email,
      name: name ?? null,
    };
    return this.findOrCreateUserBySso("firebase", profile);
  }

  private normalizeSsoProfile(profile: SsoProfile): SsoProfile {
    if (typeof profile.providerId !== "string" || !profile.providerId.trim()) {
      throw new Error("SSO profile missing providerId");
    }
    if (typeof profile.email !== "string" || !profile.email.trim()) {
      throw new Error("SSO profile missing email");
    }
    if (
      profile.name !== undefined &&
      profile.name !== null &&
      typeof profile.name !== "string"
    ) {
      throw new Error("SSO profile name must be a string or null");
    }
    return {
      providerId: profile.providerId.trim(),
      email: profile.email.trim(),
      name:
        profile.name === undefined
          ? undefined
          : profile.name === null
            ? null
            : profile.name.trim() || null,
    };
  }

  async findOrCreateUserBySso(
    provider: "google" | "github" | "apple" | "firebase" | "oidc",
    profile: SsoProfile
  ): Promise<{ id: string; email: string; name: string | null }> {
    const normalized = this.normalizeSsoProfile(profile);
    const existing = await this.prisma.account.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId: normalized.providerId,
        },
      },
      include: { user: true },
    });
    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: {
          ...(normalized.name != null && { name: normalized.name }),
          ...(normalized.email && { email: normalized.email }),
        },
      });
      await this.ensureUserOrganization(existing.userId);
      await this.acceptPendingProjectInvitesByEmail(
        existing.userId,
        normalized.email
      );
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: existing.userId },
      });
      return { id: user.id, email: user.email, name: user.name };
    }
    // Each SSO account gets its own User and Organization (no linking by email).
    const user = await this.prisma.user.create({
      data: {
        email: normalized.email,
        name: normalized.name ?? undefined,
      },
    });
    await this.prisma.account.create({
      data: {
        userId: user.id,
        provider,
        providerId: normalized.providerId,
      },
    });
    await this.ensureUserOrganization(user.id);
    await this.acceptPendingProjectInvitesByEmail(user.id, normalized.email);
    return { id: user.id, email: user.email, name: user.name };
  }

  signToken(user: { id: string; email: string }): string {
    return jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), {
      expiresIn: "7d",
    });
  }

  async exchangeGoogleCode(code: string): Promise<SsoProfile> {
    const redirectUri = this.getRedirectUri("google");
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required");
    const tokenRes = (await postForm("https://oauth2.googleapis.com/token", {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    })) as { access_token?: string };
    const accessToken = tokenRes.access_token;
    if (!accessToken) throw new Error("No access_token from Google");
    const userRes = await fetchWithTimeout(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!userRes.ok) throw new Error("Google userinfo failed");
    const user = (await userRes.json()) as {
      id: string;
      email?: string;
      name?: string;
    };
    const email = user.email ?? "";
    if (!email) throw new Error("Google profile missing email");
    return {
      providerId: user.id,
      email,
      name: user.name ?? null,
    };
  }

  async exchangeGitHubCode(code: string): Promise<SsoProfile> {
    const redirectUri = this.getRedirectUri("github");
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      throw new Error("GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET required");
    const tokenRes = (await postForm(
      "https://github.com/login/oauth/access_token",
      {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      },
      { Accept: "application/json" }
    )) as { access_token?: string };
    const accessToken = tokenRes.access_token;
    if (!accessToken) throw new Error("No access_token from GitHub");
    const userRes = await fetchWithTimeout("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (!userRes.ok) throw new Error("GitHub user API failed");
    const user = (await userRes.json()) as {
      id: number;
      login: string;
      email?: string | null;
      name?: string | null;
    };
    let email = user.email;
    if (!email) {
      const emailsRes = await fetchWithTimeout(
        "https://api.github.com/user/emails",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as Array<{
          email: string;
          primary?: boolean;
        }>;
        const primary = emails.find((e) => e.primary) ?? emails[0];
        email = primary?.email;
      }
    }
    if (!email) throw new Error("GitHub profile missing email");
    return {
      providerId: String(user.id),
      email,
      name: user.name ?? user.login ?? null,
    };
  }

  async exchangeAppleCode(code: string): Promise<SsoProfile> {
    const redirectUri = this.getRedirectUri("apple");
    const clientId = process.env.APPLE_CLIENT_ID;
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const privateKey = process.env.APPLE_PRIVATE_KEY;
    if (!clientId || !teamId || !keyId || !privateKey)
      throw new Error(
        "APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY required"
      );
    const now = Math.floor(Date.now() / 1000);
    const clientSecret = jwt.sign(
      {
        iss: teamId,
        iat: now,
        exp: now + 60 * 5,
        aud: "https://appleid.apple.com",
        sub: clientId,
      },
      privateKey.replace(/\\n/g, "\n"),
      { algorithm: "ES256", keyid: keyId }
    );
    const tokenRes = (await postForm("https://appleid.apple.com/auth/token", {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    })) as { id_token?: string };
    const idToken = tokenRes.id_token;
    if (!idToken) throw new Error("No id_token from Apple");
    const payload = await this.verifyAppleIdToken(idToken, clientId);
    if (!payload?.sub) throw new Error("Invalid Apple id_token");
    const email =
      payload.email ?? `apple-${payload.sub}@privaterelay.appleid.com`;
    return {
      providerId: payload.sub,
      email,
      name: null,
    };
  }

  private async verifyAppleIdToken(
    idToken: string,
    audience: string
  ): Promise<{ sub: string; email?: string }> {
    const payload = await new Promise<jwt.JwtPayload>((resolve, reject) => {
      jwt.verify(
        idToken,
        (header, cb) => {
          const kid = typeof header.kid === "string" ? header.kid : "";
          if (!kid) {
            cb(new Error("Apple id_token missing key id"));
            return;
          }
          this.getApplePublicKeyPem(kid)
            .then((key) => cb(null, key))
            .catch((err) =>
              cb(err instanceof Error ? err : new Error(String(err)))
            );
        },
        {
          algorithms: ["RS256"],
          issuer: "https://appleid.apple.com",
          audience,
        },
        (err, decoded) => {
          if (err) {
            reject(err);
            return;
          }
          if (!decoded || typeof decoded !== "object") {
            reject(new Error("Invalid Apple id_token payload"));
            return;
          }
          resolve(decoded as jwt.JwtPayload);
        }
      );
    });
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    const email = typeof payload.email === "string" ? payload.email : undefined;
    if (!sub) throw new Error("Apple id_token missing subject");
    return { sub, email };
  }

  private async getApplePublicKeyPem(kid: string): Promise<string> {
    const now = Date.now();
    if (this.applePublicKeysByKid && now < this.applePublicKeysExpiresAt) {
      const cached = this.applePublicKeysByKid[kid];
      if (cached) return cached;
    }
    const response = await fetchWithTimeout(APPLE_KEYS_URL);
    if (!response.ok) {
      throw new Error("Failed to fetch Apple signing keys");
    }
    const body = (await response.json()) as {
      keys?: Array<Record<string, unknown>>;
    };
    const map: Record<string, string> = {};
    for (const entry of body.keys ?? []) {
      const entryKid = typeof entry.kid === "string" ? entry.kid : "";
      const kty = typeof entry.kty === "string" ? entry.kty : "";
      const n = typeof entry.n === "string" ? entry.n : "";
      const e = typeof entry.e === "string" ? entry.e : "";
      if (!entryKid || kty !== "RSA" || !n || !e) continue;
      const keyObject = crypto.createPublicKey({
        key: { kty, n, e },
        format: "jwk",
      });
      const pem = keyObject.export({ format: "pem", type: "spki" });
      map[entryKid] = pem.toString();
    }
    this.applePublicKeysByKid = map;
    this.applePublicKeysExpiresAt = now + APPLE_KEYS_CACHE_TTL_MS;
    const resolved = map[kid];
    if (!resolved) {
      throw new Error("Apple signing key not found");
    }
    return resolved;
  }
}
