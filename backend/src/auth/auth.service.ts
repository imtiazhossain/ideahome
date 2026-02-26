import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma.service";
import { getJwtSecret } from "./jwt-secret";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const STATE_FUTURE_SKEW_MS = 60 * 1000; // 1 minute
const OAUTH_FETCH_TIMEOUT_MS = 15_000;

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
  constructor(private readonly prisma: PrismaService) {}

  getRedirectUri(provider: "google" | "github" | "apple"): string {
    const base = process.env.BACKEND_URL ?? "http://localhost:3001";
    return `${base}/auth/${provider}/callback`;
  }

  getFrontendCallbackUrl(token: string): string {
    const base =
      process.env.FRONTEND_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    const baseUrl = `${base.replace(/\/$/, "")}/login/callback`;
    return token ? `${baseUrl}#token=${encodeURIComponent(token)}` : baseUrl;
  }

  createState(provider: "google" | "github" | "apple"): string {
    const payload = {
      p: provider,
      iat: Date.now(),
      n: crypto.randomBytes(8).toString("hex"),
    };
    const payloadStr = JSON.stringify(payload);
    const b64 = Buffer.from(payloadStr, "utf8").toString("base64url");
    const sig = crypto
      .createHmac("sha256", getJwtSecret())
      .update(payloadStr)
      .digest("base64url");
    return `${b64}.${sig}`;
  }

  consumeState(state: string): "google" | "github" | "apple" | null {
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
    let payload: { p?: string; iat?: number };
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
    return payload.p;
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
    if (user.organizationId) return user;
    const org = await this.prisma.organization.create({
      data: { name: "My Workspace" },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { organizationId: org.id },
    });
    return { ...user, organizationId: org.id };
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
    const payload = jwt.decode(idToken) as {
      sub: string;
      email?: string;
    } | null;
    if (!payload?.sub) throw new Error("Invalid Apple id_token");
    const email =
      payload.email ?? `apple-${payload.sub}@privaterelay.appleid.com`;
    return {
      providerId: payload.sub,
      email,
      name: null,
    };
  }
}
