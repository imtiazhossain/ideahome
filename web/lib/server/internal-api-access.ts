import type { NextApiRequest } from "next";
import crypto from "crypto";

export type InternalApiAccessResult =
  | { allowed: true }
  | { allowed: false; status: number; error: string };

type InternalApiAccessOptions = {
  devOnlyError: string;
  localhostError: string;
  tokenHeaderName?: string;
  requiredTokenEnvName?: string;
};

function getClientIp(req: NextApiRequest): string {
  return req.socket.remoteAddress ?? "";
}

function isLocalIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/, "");
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "localhost"
  );
}

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function ensureInternalApiAccess(
  req: NextApiRequest,
  options: InternalApiAccessOptions
): InternalApiAccessResult {
  const tokenHeaderName = options.tokenHeaderName ?? "x-run-coverage-token";
  const requiredTokenEnvName =
    options.requiredTokenEnvName ?? "RUN_COVERAGE_TOKEN";
  const tokenHeader = req.headers[tokenHeaderName];
  if (Array.isArray(tokenHeader) && tokenHeader.length !== 1) {
    return { allowed: false, status: 401, error: "Unauthorized" };
  }
  const providedTokenRaw = Array.isArray(tokenHeader)
    ? tokenHeader[0]
    : tokenHeader;
  const providedToken =
    typeof providedTokenRaw === "string"
      ? providedTokenRaw.trim()
      : providedTokenRaw;
  const requiredToken = process.env[requiredTokenEnvName];
  const ip = getClientIp(req);
  const isLocalRequest = isLocalIp(ip);

  // Localhost access is allowed even when NODE_ENV is "production"
  // (e.g. local `next start`), but non-local requests in non-dev mode
  // must provide the configured internal token.
  if (process.env.NODE_ENV !== "development" && !requiredToken && !isLocalRequest) {
    return { allowed: false, status: 403, error: options.devOnlyError };
  }

  if (requiredToken) {
    const normalizedRequiredToken = requiredToken.trim();
    if (
      typeof providedToken !== "string" ||
      !timingSafeEqualString(providedToken, normalizedRequiredToken)
    ) {
      return { allowed: false, status: 401, error: "Unauthorized" };
    }
    return { allowed: true };
  }

  if (!isLocalRequest) {
    return { allowed: false, status: 403, error: options.localhostError };
  }
  return { allowed: true };
}
