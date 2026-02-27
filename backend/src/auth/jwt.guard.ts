import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma.service";
import { FirebaseService } from "./firebase.service";
import { AuthService } from "./auth.service";
import { getJwtSecret } from "./jwt-secret";

const AUTH_TOKEN_COOKIE_KEY = "ideahome_token";

function getTokenFromCookie(rawCookie: unknown): string {
  if (typeof rawCookie !== "string" || !rawCookie.trim()) return "";
  const parts = rawCookie.split(";");
  for (const part of parts) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name !== AUTH_TOKEN_COOKIE_KEY) continue;
    const value = valueParts.join("=");
    if (!value) return "";
    try {
      return decodeURIComponent(value).trim();
    } catch {
      return value.trim();
    }
  }
  return "";
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers["authorization"] ?? req.headers["Authorization"];
    const cookieToken = getTokenFromCookie(req.headers?.cookie);
    const authValue = auth ?? (cookieToken ? `Bearer ${cookieToken}` : "");
    let hadAuth = false;

    if (authValue) {
      hadAuth = true;
      const parts = (Array.isArray(authValue) ? authValue[0] : authValue).split(
        " "
      );
      if (parts.length !== 2 || parts[0] !== "Bearer") {
        throw new UnauthorizedException("Invalid Authorization format");
      }
      const token = parts[1];
      try {
        const payload = jwt.verify(token, getJwtSecret()) as {
          sub?: string;
          email?: string;
        };
        if (payload.sub) {
          await this.ensureUserAndOrg(payload.sub);
        }
        req.user = { sub: payload.sub, email: payload.email };
        return true;
      } catch {
        if (this.firebase.isConfigured()) {
          const decoded = await this.firebase.verifyIdToken(token);
          if (decoded) {
            const user = await this.authService.findOrCreateUserByFirebase(
              decoded.uid,
              decoded.email ?? "",
              decoded.name
            );
            await this.ensureUserAndOrg(user.id);
            req.user = { sub: user.id, email: user.email };
            return true;
          }
        }
      }
    }

    const devUser = await this.tryDevUser();
    if (devUser) {
      await this.ensureUserAndOrg(devUser.id);
      req.user = { sub: devUser.id, email: devUser.email };
      return true;
    }

    throw new UnauthorizedException(
      hadAuth ? "Invalid or expired token" : "Missing Authorization header"
    );
  }

  private async tryDevUser(): Promise<{ id: string; email: string } | null> {
    if (process.env.NODE_ENV === "production") return null;
    if (process.env.SKIP_AUTH_DEV !== "true") return null;
    if (process.env.ALLOW_DEV_AUTH_BYPASS !== "true") return null;
    return this.resolveDevUser();
  }

  private async ensureUserAndOrg(userId: string): Promise<void> {
    await this.authService.ensureUserOrganization(userId);
  }

  private async resolveDevUser(): Promise<{
    id: string;
    email: string;
  } | null> {
    const devUserId = process.env.DEV_USER_ID?.trim();
    if (devUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: devUserId },
        select: { id: true, email: true },
      });
      if (user) return user;
    }
    return this.prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true },
    });
  }
}
