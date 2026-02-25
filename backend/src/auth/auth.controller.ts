import { Body, Controller, Get, Post, Query, Res } from "@nestjs/common";
import { Response } from "express";
import { PrismaService } from "../prisma.service";
import { AuthService } from "./auth.service";
import { FirebaseService } from "./firebase.service";
import type { SsoProfile } from "./auth.service";

const verifierStore = new Map<string, string>();

type OAuthCallbackQuery = { code?: string; state?: string };

@Controller("auth")
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly firebase: FirebaseService
  ) {}

  private redirectWithError(res: Response, error: string) {
    const url = `${this.authService.getFrontendCallbackUrl("")}?error=${encodeURIComponent(error)}`;
    return res.redirect(url);
  }

  private async handleSsoCallback(
    res: Response,
    provider: "google" | "github" | "apple",
    state: string,
    code: string,
    exchangeCode: (code: string) => Promise<SsoProfile>
  ) {
    const consumed = this.authService.consumeState(state);
    if (consumed !== provider || !code) {
      return this.redirectWithError(res, "invalid_callback");
    }
    try {
      const profile = await exchangeCode(code);
      const user = await this.authService.findOrCreateUserBySso(
        provider,
        profile
      );
      const token = this.authService.signToken(user);
      return res.redirect(this.authService.getFrontendCallbackUrl(token));
    } catch (e) {
      return this.redirectWithError(
        res,
        e instanceof Error ? e.message : "Unknown error"
      );
    }
  }

  private async getOidcClient() {
    const { Issuer } = await import("openid-client");
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

  @Get("login")
  async login(@Res() res: Response) {
    const { generators } = await import("openid-client");
    const client = await this.getOidcClient();

    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const state = generators.state();
    verifierStore.set(state, codeVerifier);

    const authUrl = client.authorizationUrl({
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    });

    res.redirect(authUrl);
  }

  @Get("callback")
  async callback(
    @Res() res: Response,
    @Query() query: OAuthCallbackQuery
  ) {
    const { code, state } = query;
    if (!code || !state) {
      return res.status(400).json({ error: "Missing code or state" });
    }
    const client = await this.getOidcClient();
    const redirectUri =
      process.env.OIDC_REDIRECT_URI ??
      /* istanbul ignore next */ "http://localhost:3001/auth/callback";

    const codeVerifier = verifierStore.get(state);
    verifierStore.delete(state);

    const tokenSet = await client.callback(
      redirectUri,
      { code },
      { code_verifier: codeVerifier, state }
    );
    const userinfo = await client.userinfo(tokenSet.access_token as string);

    const email = userinfo.email;
    if (!email) {
      return res.status(400).json({ error: "No email in userinfo" });
    }

    const existing = await this.prisma.user.findFirst({
      where: { email },
      orderBy: { createdAt: "asc" },
    });
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { name: userinfo.name || undefined },
        })
      : await this.prisma.user.create({
          data: { email, name: userinfo.name },
        });
    await this.authService.ensureUserOrganization(user.id);

    const token = this.authService.signToken(user);

    // For now return token in JSON (client should redirect and store it)
    return res.json({ token, user });
  }

  @Get("google")
  async google(@Res() res: Response) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
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
    return this.handleSsoCallback(
      res,
      "google",
      state,
      code,
      (c) => this.authService.exchangeGoogleCode(c)
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
    return this.handleSsoCallback(
      res,
      "github",
      state,
      code,
      (c) => this.authService.exchangeGitHubCode(c)
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
    return this.handleSsoCallback(
      res,
      "apple",
      state,
      code,
      (c) => this.authService.exchangeAppleCode(c)
    );
  }

  /** Exchange a Firebase ID token for a backend JWT and user. Body: { idToken: string }. */
  @Post("firebase-session")
  async firebaseSession(
    @Res() res: Response,
    @Body("idToken") idToken: string
  ) {
    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({ error: "idToken required" });
    }
    if (!this.firebase.isConfigured()) {
      return res.status(503).json({
        error:
          "Firebase is not configured. Set FIREBASE_PROJECT_ID and credentials.",
      });
    }
    const decoded = await this.firebase.verifyIdToken(idToken);
    if (!decoded) {
      return res
        .status(401)
        .json({ error: "Invalid or expired Firebase token" });
    }
    const email = decoded.email ?? "";
    if (!email) {
      return res.status(400).json({ error: "Firebase token missing email" });
    }
    const user = await this.authService.findOrCreateUserByFirebase(
      decoded.uid,
      email,
      decoded.name
    );
    const token = this.authService.signToken(user);
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  }
}
