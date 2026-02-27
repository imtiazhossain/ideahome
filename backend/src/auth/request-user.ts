import { UnauthorizedException } from "@nestjs/common";
import { Request } from "express";

export type AuthenticatedRequest = Request & {
  user?: { sub?: string; email?: string };
};

export function requireUserId(req: AuthenticatedRequest): string {
  const userId = req.user?.sub;
  if (typeof userId !== "string" || !userId.trim()) {
    throw new UnauthorizedException("Missing authenticated user");
  }
  return userId.trim();
}
