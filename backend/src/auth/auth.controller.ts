import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { PrismaService } from "../prisma.service";
import { AuthService } from "./auth.service";
import * as jwt from "jsonwebtoken";

const verifierStore = new Map<string, string>();

@Controller("auth")
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService
  ) {}

  @Get("login")
  async login(@Res() res: Response) {
    const { Issuer, generators } = await import("openid-client");
    const issuer = await Issuer.discover(
      process.env.OIDC_ISSUER ?? /* istanbul ignore next */ ""
    );
    const client = new issuer.Client({
      client_id: process.env.OIDC_CLIENT_ID,
      client_secret: process.env.OIDC_CLIENT_SECRET,
      redirect_uris: [
        process.env.OIDC_REDIRECT_URI ??
          /* istanbul ignore next */ "http://localhost:3001/auth/callback",
      ],
      response_types: ["code"],
    });

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
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: any
  ) {
    const { Issuer, generators } = await import("openid-client");
    const { code, state } = query;
    const issuer = await Issuer.discover(
      process.env.OIDC_ISSUER ?? /* istanbul ignore next */ ""
    );
    const client = new issuer.Client({
      client_id: process.env.OIDC_CLIENT_ID,
      client_secret: process.env.OIDC_CLIENT_SECRET,
      redirect_uris: [
        process.env.OIDC_REDIRECT_URI ??
          /* istanbul ignore next */ "http://localhost:3001/auth/callback",
      ],
      response_types: ["code"],
    });

    const codeVerifier = verifierStore.get(state);
    verifierStore.delete(state);

    const tokenSet = await client.callback(
      process.env.OIDC_REDIRECT_URI ??
        /* istanbul ignore next */ "http://localhost:3001/auth/callback",
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

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET ?? /* istanbul ignore next */ "dev-secret",
      { expiresIn: "7d" }
    );

    // For now return token in JSON (client should redirect and store it)
    return res.json({ token, user });
  }

  @Get("google")
  async google(@Res() res: Response) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      const base = this.authService.getFrontendCallbackUrl("");
      return res.redirect(
        `${base}?error=${encodeURIComponent("Google SSO is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend .env.")}`
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
    const provider = this.authService.consumeState(state);
    if (provider !== "google" || !code) {
      const base = this.authService.getFrontendCallbackUrl("");
      return res.redirect(
        `${base}?error=${encodeURIComponent("invalid_callback")}`
      );
    }
    try {
      const profile = await this.authService.exchangeGoogleCode(code);
      const user = await this.authService.findOrCreateUserBySso(
        "google",
        profile
      );
      const token = this.authService.signToken(user);
      return res.redirect(this.authService.getFrontendCallbackUrl(token));
    } catch (e) {
      const err = encodeURIComponent(
        e instanceof Error ? e.message : "Unknown error"
      );
      const base = this.authService.getFrontendCallbackUrl("");
      return res.redirect(`${base}?error=${err}`);
    }
  }

  @Get("github")
  async github(@Res() res: Response) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      const base = this.authService.getFrontendCallbackUrl("");
      return res.redirect(
        `${base}?error=${encodeURIComponent("GitHub SSO is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend .env.")}`
      );
    }
    const state = this.authService.createState("github");
    const redirectUri = this.authService.getRedirectUri("github");
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "user:email read:user");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return res.redirect(url.toString());
  }

  @Get("github/callback")
  async githubCallback(
    @Res() res: Response,
    @Query("code") code: string,
    @Query("state") state: string
  ) {
    const provider = this.authService.consumeState(state);
    if (provider !== "github" || !code) {
      const base = this.authService.getFrontendCallbackUrl("");
      return res.redirect(
        `${base}?error=${encodeURIComponent("invalid_callback")}`
      );
    }
    try {
      const profile = await this.authService.exchangeGitHubCode(code);
      const user = await this.authService.findOrCreateUserBySso(
        "github",
        profile
      );
      const token = this.authService.signToken(user);
      return res.redirect(this.authService.getFrontendCallbackUrl(token));
    } catch (e) {
      const err = encodeURIComponent(
        e instanceof Error ? e.message : "Unknown error"
      );
      const base = this.authService.getFrontendCallbackUrl("");
      return res.redirect(`${base}?error=${err}`);
    }
  }

  @Get("apple")
  async apple(@Res() res: Response) {
    const clientId = process.env.APPLE_CLIENT_ID;
    if (!clientId) {
      const base = this.authService.getFrontendCallbackUrl("");
      return res.redirect(
        `${base}?error=${encodeURIComponent("Apple SSO is not configured. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY in backend .env.")}`
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
    const provider = this.authService.consumeState(state);
    if (provider !== "apple" || !code) {
      const base = this.authService.getFrontendCallbackUrl("");
      return res.redirect(
        `${base}?error=${encodeURIComponent("invalid_callback")}`
      );
    }
    try {
      const profile = await this.authService.exchangeAppleCode(code);
      const user = await this.authService.findOrCreateUserBySso(
        "apple",
        profile
      );
      const token = this.authService.signToken(user);
      return res.redirect(this.authService.getFrontendCallbackUrl(token));
    } catch (e) {
      const err = encodeURIComponent(
        e instanceof Error ? e.message : "Unknown error"
      );
      const base = this.authService.getFrontendCallbackUrl("");
      return res.redirect(`${base}?error=${err}`);
    }
  }
}
