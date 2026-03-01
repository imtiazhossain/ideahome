import {
  AUTH_PARAM_ERROR,
  AUTH_PARAM_REDIRECT_URI,
  AUTH_PARAM_TOKEN,
  IDEAHOME_API_ORIGIN as APP_API_URL,
  MOBILE_DEEP_LINK_REDIRECT_URI,
  pathAuthMobile,
  readUrlParam,
  sanitizeAuthToken,
} from "@ideahome/shared-config";
import type { AuthProvider } from "../types";

export function parseTokenFromRedirect(redirectUrl: string): string {
  return sanitizeAuthToken(readUrlParam(redirectUrl, AUTH_PARAM_TOKEN));
}

export function parseErrorFromRedirect(redirectUrl: string): string {
  return readUrlParam(redirectUrl, AUTH_PARAM_ERROR);
}

export function buildMobileAuthUrl(provider: AuthProvider): string {
  const url = new URL(`${APP_API_URL}${pathAuthMobile(provider)}`);
  url.searchParams.set(AUTH_PARAM_REDIRECT_URI, MOBILE_DEEP_LINK_REDIRECT_URI);
  return url.toString();
}

export function readUserIdFromToken(jwt: string): string {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return "";
    const payload = parts[1];
    const base64Raw = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64Raw.length % 4)) % 4;
    const base64 = base64Raw + "=".repeat(padLen);
    const decoded = atob(base64);
    const parsed = JSON.parse(decoded) as { sub?: unknown };
    return typeof parsed.sub === "string" ? parsed.sub.trim() : "";
  } catch {
    return "";
  }
}

export function readUserEmailFromToken(jwt: string): string {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return "";
    const payload = parts[1];
    const base64Raw = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64Raw.length % 4)) % 4;
    const base64 = base64Raw + "=".repeat(padLen);
    const decoded = atob(base64);
    const parsed = JSON.parse(decoded) as { email?: unknown };
    return typeof parsed.email === "string" ? parsed.email.trim() : "";
  } catch {
    return "";
  }
}
