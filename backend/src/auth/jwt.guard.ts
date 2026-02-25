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

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers["authorization"] || req.headers["Authorization"];

    if (auth) {
      const parts = (Array.isArray(auth) ? auth[0] : auth).split(" ");
      if (parts.length !== 2 || parts[0] !== "Bearer") {
        throw new UnauthorizedException("Invalid Authorization format");
      }
      const token = parts[1];
      try {
        const payload = jwt.verify(
          token,
          process.env.JWT_SECRET || "dev-secret"
        ) as { sub?: string; email?: string };
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
            req.user = { sub: user.id, email: user.email };
            return true;
          }
        }
        if (process.env.SKIP_AUTH_DEV === "true") {
          const devUser = await this.resolveDevUser();
          if (devUser) {
            req.user = { sub: devUser.id, email: devUser.email };
            return true;
          }
        }
        throw new UnauthorizedException("Invalid or expired token");
      }
    }

    if (process.env.SKIP_AUTH_DEV === "true") {
      const devUser = await this.resolveDevUser();
      if (devUser) {
        req.user = { sub: devUser.id, email: devUser.email };
        return true;
      }
    }

    throw new UnauthorizedException("Missing Authorization header");
  }

  private async resolveDevUser(): Promise<{
    id: string;
    email: string;
  } | null> {
    const devUserId = process.env.DEV_USER_ID;
    if (devUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: devUserId },
        select: { id: true, email: true },
      });
      return user;
    }
    const first = await this.prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true },
    });
    return first;
  }
}
