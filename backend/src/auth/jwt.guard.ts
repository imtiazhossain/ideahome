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

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly ensuredOrgUserIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers["authorization"] ?? req.headers["Authorization"];
    let hadAuth = false;

    if (auth) {
      hadAuth = true;
      const parts = (Array.isArray(auth) ? auth[0] : auth).split(" ");
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
    if (process.env.SKIP_AUTH_DEV !== "true") return null;
    return this.resolveDevUser();
  }

  private async ensureUserAndOrg(userId: string): Promise<void> {
    if (this.ensuredOrgUserIds.has(userId)) return;
    await this.authService.ensureUserOrganization(userId);
    this.ensuredOrgUserIds.add(userId);
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
