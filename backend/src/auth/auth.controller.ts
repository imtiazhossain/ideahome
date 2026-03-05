import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import { Response } from "express";
import * as crypto from "crypto";
import { AuthService } from "./auth.service";
import { FirebaseService } from "./firebase.service";
import type { SsoProfile } from "./auth.service";
import { getJwtSecret } from "./jwt-secret";

const OIDC_STATE_TTL_MS = 10 * 60 * 1000;
const OIDC_STATE_FUTURE_SKEW_MS = 60 * 1000;

type OAuthCallbackQuery = { code?: string; state?: string };
type OAuthProvider = "google" | "github" | "apple";

async function importOpenIdClient(): Promise<typeof import("openid-client")> {
  // Use require in Jest so moduleNameMapper can provide the test mock.
  if (process.env.JEST_WORKER_ID) {
    const jestRequire = (0, eval)("require") as (id: string) => unknown;
    return jestRequire("openid-client") as typeof import("openid-client");
  }
  // Keep native dynamic import for ESM-only package in CJS output.
  return (await new Function("m", "return import(m)")(
    "openid-client"
  )) as typeof import("openid-client");
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly firebase: FirebaseService
  ) {}

  private createOidcState(codeVerifier: string): string {
    const payload = {
      iat: Date.now(),
      n: crypto.randomBytes(8).toString("hex"),
      v: codeVerifier,
    };
    const payloadStr = JSON.stringify(payload);
    const b64 = Buffer.from(payloadStr, "utf8").toString("base64url");
    const sig = crypto
      .createHmac("sha256", getJwtSecret())
      .update(payloadStr)
      .digest("base64url");
    return `${b64}.${sig}`;
  }

  private consumeOidcState(state: string): string | null {
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
    let payload: { iat?: number; v?: string };
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      return null;
    }
    if (
      typeof payload.iat !== "number" ||
      payload.iat > Date.now() + OIDC_STATE_FUTURE_SKEW_MS ||
      Date.now() - payload.iat > OIDC_STATE_TTL_MS ||
      typeof payload.v !== "string" ||
      !payload.v
    ) {
      return null;
    }
    return payload.v;
  }

  private redirectWithError(res: Response, error: string) {
    const url = this.authService.getErrorRedirectUrl(error);
    return res.redirect(url);
  }

  private redirectWithErrorForTarget(
    res: Response,
    error: string,
    mobileRedirectUri?: string | null
  ) {
    const url = this.authService.getErrorRedirectUrl(error, mobileRedirectUri);
    return res.redirect(url);
  }

  private async handleSsoCallback(
    res: Response,
    provider: OAuthProvider,
    state: string,
    code: string,
    exchangeCode: (code: string) => Promise<SsoProfile>
  ) {
    const safeState = typeof state === "string" ? state.trim() : "";
    const safeCode = typeof code === "string" ? code.trim() : "";
    const consumed = this.authService.consumeState(safeState);
    if (consumed?.provider !== provider || !safeCode) {
      return this.redirectWithErrorForTarget(
        res,
        "invalid_callback",
        consumed?.mobileRedirectUri
      );
    }
    try {
      const profile = await exchangeCode(safeCode);
      const user = await this.authService.findOrCreateUserBySso(
        provider,
        profile
      );
      const token = this.authService.signToken(user);
      return res.redirect(
        this.authService.getFrontendCallbackUrl(token, consumed.mobileRedirectUri)
      );
    } catch {
      // Do not leak provider/internal error details in redirect query params.
      return this.redirectWithErrorForTarget(
        res,
        "sso_callback_failed",
        consumed.mobileRedirectUri
      );
    }
  }

  private resolveProvider(rawProvider: string): OAuthProvider | null {
    if (rawProvider === "google") return "google";
    if (rawProvider === "github") return "github";
    if (rawProvider === "apple") return "apple";
    return null;
  }

  private async getOidcClient() {
    const { Issuer } = await importOpenIdClient();
    const issuer = await Issuer.discover(
      process.env.OIDC_ISSUER ?? /* istanbul ignore next */ ""
    );
    const redirectUri =
      process.env.OIDC_REDIRECT_URI ??
      /* istanbul ignore next */ "http://localhost:3001/auth/callback";
    return new issuer.Client({
      client_id: process.env.OIDC_CLIENT_ID,
      client_secret: process.env.OIDC_CLIENT_SECRET,
      redirect_uris: [redirectUri],
      response_types: ["code"],
    });
  }

  @Get("providers")
  providers() {
    return {
      google: Boolean(
        process.env.GOOGLE_CLIENT_ID?.trim() &&
          process.env.GOOGLE_CLIENT_SECRET?.trim()
      ),
      github: Boolean(
        process.env.GITHUB_CLIENT_ID?.trim() &&
          process.env.GITHUB_CLIENT_SECRET?.trim()
      ),
      apple: Boolean(
        process.env.APPLE_CLIENT_ID?.trim() &&
          process.env.APPLE_TEAM_ID?.trim() &&
          process.env.APPLE_KEY_ID?.trim() &&
          process.env.APPLE_PRIVATE_KEY?.trim()
      ),
    };
  }

  @Get("login")
  async login(@Res() res: Response) {
    const { generators } = await importOpenIdClient();
    const client = await this.getOidcClient();

    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const state = this.createOidcState(codeVerifier);

    const authUrl = client.authorizationUrl({
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    });

    res.redirect(authUrl);
  }

  @Get("callback")
  async callback(@Res() res: Response, @Query() query: OAuthCallbackQuery) {
    const code = typeof query.code === "string" ? query.code.trim() : "";
    const state = typeof query.state === "string" ? query.state.trim() : "";
    if (!code || !state) {
      return res.status(400).json({ error: "Missing code or state" });
    }
    const client = await this.getOidcClient();
    const redirectUri =
      process.env.OIDC_REDIRECT_URI ??
      /* istanbul ignore next */ "http://localhost:3001/auth/callback";

    const codeVerifier = this.consumeOidcState(state);
    if (!codeVerifier) {
      return res.status(400).json({ error: "Invalid or expired state" });
    }

    const tokenSet = await client.callback(
      redirectUri,
      { code },
      { code_verifier: codeVerifier, state }
    );
    const userinfo = await client.userinfo(tokenSet.access_token as string);

    const emailRaw = (userinfo as { email?: unknown }).email;
    const email =
      typeof emailRaw === "string" && emailRaw.trim() ? emailRaw.trim() : "";
    const sub =
      typeof (userinfo as { sub?: unknown }).sub === "string"
        ? ((userinfo as { sub?: string }).sub ?? "")
        : "";
    const nameRaw = (userinfo as { name?: unknown }).name;
    const name =
      typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null;
    if (!email) {
      return res.status(400).json({ error: "No email in userinfo" });
    }
    if (!sub) {
      return res.status(400).json({ error: "No sub in userinfo" });
    }

    const user = await this.authService.findOrCreateUserBySso("oidc", {
      providerId: sub,
      email,
      name,
    });

    const token = this.authService.signToken(user);

    // For now return token in JSON (client should redirect and store it)
    return res.json({ token, user });
  }

  @Get("google")
  async google(@Res() res: Response) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId?.trim() || !clientSecret?.trim()) {
      return this.redirectWithError(
        res,
        "Google SSO is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend .env."
      );
    }
    const state = this.authService.createState("google");
    const redirectUri = this.authService.getRedirectUri("google");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return res.redirect(url.toString());
  }

  @Get("google/callback")
  async googleCallback(
    @Res() res: Response,
    @Query("code") code: string,
    @Query("state") state: string
  ) {
    return this.handleSsoCallback(res, "google", state, code, (c) =>
      this.authService.exchangeGoogleCode(c)
    );
  }

  @Get("github")
  async github(@Res() res: Response) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return this.redirectWithError(
        res,
        "GitHub SSO is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend .env."
      );
    }
    const state = this.authService.createState("github");
    const redirectUri = this.authService.getRedirectUri("github");
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "user:email read:user");
    url.searchParams.set("state", state);
    return res.redirect(url.toString());
  }

  @Get("github/callback")
  async githubCallback(
    @Res() res: Response,
    @Query("code") code: string,
    @Query("state") state: string
  ) {
    return this.handleSsoCallback(res, "github", state, code, (c) =>
      this.authService.exchangeGitHubCode(c)
    );
  }

  @Get("apple")
  async apple(@Res() res: Response) {
    const clientId = process.env.APPLE_CLIENT_ID;
    if (!clientId) {
      return this.redirectWithError(
        res,
        "Apple SSO is not configured. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY in backend .env."
      );
    }
    const state = this.authService.createState("apple");
    const redirectUri = this.authService.getRedirectUri("apple");
    const url = new URL("https://appleid.apple.com/auth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code id_token");
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", "name email");
    url.searchParams.set("state", state);
    return res.redirect(url.toString());
  }

  @Get("apple/callback")
  async appleCallback(
    @Res() res: Response,
    @Query("code") code: string,
    @Query("state") state: string
  ) {
    return this.handleSsoCallback(res, "apple", state, code, (c) =>
      this.authService.exchangeAppleCode(c)
    );
  }

  @Get("mobile/:provider")
  async mobileProviderLogin(
    @Param("provider") providerRaw: string,
    @Res() res: Response,
    @Query("redirect_uri") redirectUri: string
  ) {
    const provider = this.resolveProvider((providerRaw ?? "").trim());
    if (!provider) {
      return this.redirectWithError(res, "unsupported_provider");
    }
    const mobileRedirectUri =
      this.authService.normalizeMobileRedirectUri(redirectUri);
    if (!mobileRedirectUri) {
      return this.redirectWithError(res, "invalid_mobile_redirect_uri");
    }
    const state = this.authService.createState(provider, mobileRedirectUri);
    const backendBase = process.env.BACKEND_URL ?? "http://localhost:3001";
    const callbackUrl = `${backendBase}/auth/${provider}/callback`;

    if (provider === "google") {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId?.trim() || !clientSecret?.trim()) {
        return this.redirectWithErrorForTarget(
          res,
          "google_not_configured",
          mobileRedirectUri
        );
      }
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", callbackUrl);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("prompt", "select_account");
      return res.redirect(url.toString());
    }

    if (provider === "github") {
      const clientId = process.env.GITHUB_CLIENT_ID;
      if (!clientId?.trim()) {
        return this.redirectWithErrorForTarget(
          res,
          "github_not_configured",
          mobileRedirectUri
        );
      }
      const url = new URL("https://github.com/login/oauth/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", callbackUrl);
      url.searchParams.set("scope", "user:email read:user");
      url.searchParams.set("state", state);
      return res.redirect(url.toString());
    }

    const clientId = process.env.APPLE_CLIENT_ID;
    if (!clientId?.trim()) {
      return this.redirectWithErrorForTarget(
        res,
        "apple_not_configured",
        mobileRedirectUri
      );
    }
    const url = new URL("https://appleid.apple.com/auth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("response_type", "code id_token");
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", "name email");
    url.searchParams.set("state", state);
    return res.redirect(url.toString());
  }

  /** Exchange a Firebase ID token for a backend JWT and user. Body: { idToken: string }. */
  @Post("firebase-session")
  async firebaseSession(
    @Res() res: Response,
    @Body("idToken") idToken: string
  ) {
    if (typeof idToken !== "string" || !idToken.trim()) {
      return res.status(400).json({ error: "idToken required" });
    }
    const normalizedIdToken = idToken.trim();
    if (!this.firebase.isConfigured()) {
      return res.status(503).json({
        error:
          "Firebase is not configured. Set FIREBASE_PROJECT_ID and credentials.",
      });
    }
    const decoded = await this.firebase.verifyIdToken(normalizedIdToken);
    if (!decoded) {
      return res
        .status(401)
        .json({ error: "Invalid or expired Firebase token" });
    }
    const emailRaw = (decoded as { email?: unknown }).email;
    const email =
      typeof emailRaw === "string" && emailRaw.trim() ? emailRaw.trim() : "";
    if (!email) {
      return res.status(400).json({ error: "Firebase token missing email" });
    }
    const nameRaw = (decoded as { name?: unknown }).name;
    const name =
      typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null;
    const user = await this.authService.findOrCreateUserByFirebase(
      decoded.uid,
      email,
      name
    );
    const token = this.authService.signToken(user);
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  }
}
