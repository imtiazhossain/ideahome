import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { Issuer, generators } from "openid-client";
import { PrismaService } from "../prisma.service";
import * as jwt from "jsonwebtoken";

const verifierStore = new Map<string, string>();

@Controller("auth")
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("login")
  async login(@Res() res: Response) {
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

    const user = await this.prisma.user.upsert({
      where: { email },
      update: { name: userinfo.name || undefined },
      create: { email, name: userinfo.name },
    });

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET ?? /* istanbul ignore next */ "dev-secret",
      { expiresIn: "7d" }
    );

    // For now return token in JSON (client should redirect and store it)
    return res.json({ token, user });
  }
}
