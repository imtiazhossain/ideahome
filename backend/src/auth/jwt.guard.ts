import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import * as jwt from "jsonwebtoken";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers["authorization"] || req.headers["Authorization"];
    if (!auth) throw new UnauthorizedException("Missing Authorization header");
    const parts = (Array.isArray(auth) ? auth[0] : auth).split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer")
      throw new UnauthorizedException("Invalid Authorization format");
    const token = parts[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
      req.user = payload;
      return true;
    } catch (e) {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
