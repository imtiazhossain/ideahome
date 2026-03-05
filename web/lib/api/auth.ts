import {
  ASSISTANT_VOICE_CHANGE_EVENT as SHARED_ASSISTANT_VOICE_CHANGE_EVENT,
  AUTH_CHANGE_EVENT as SHARED_AUTH_CHANGE_EVENT,
  AUTH_TOKEN_COOKIE_KEY as SHARED_AUTH_TOKEN_COOKIE_KEY,
  AUTH_TOKEN_KEY as SHARED_AUTH_TOKEN_KEY,
  AUTH_TOKEN_SESSION_KEY as SHARED_AUTH_TOKEN_SESSION_KEY,
  NATIVE_BRIDGE_AUTH_CHANGE,
} from "@ideahome/shared";
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
  safeSessionStorageGet,
  safeSessionStorageRemove,
  safeSessionStorageSet,
} from "../storage";
export { BACKEND_CONNECTIVITY_CHANGE_EVENT, isBackendOffline } from "./http";

function readPublicEnv(name: string): string | undefined {
  const maybeProcess = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  return maybeProcess?.env?.[name];
}

const SKIP_LOGIN_DEV =
  process.env.NEXT_PUBLIC_SKIP_LOGIN_DEV ??
  readPublicEnv("NEXT_PUBLIC_SKIP_LOGIN_DEV");

export const AUTH_TOKEN_KEY = SHARED_AUTH_TOKEN_KEY;
export const AUTH_TOKEN_SESSION_KEY = SHARED_AUTH_TOKEN_SESSION_KEY;
export const AUTH_TOKEN_COOKIE_KEY = SHARED_AUTH_TOKEN_COOKIE_KEY;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const needle = `${name}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(needle)) continue;
    const rawValue = trimmed.slice(needle.length);
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}

function setCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${secure}`;
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function isSkipLoginDev(): boolean {
  return SKIP_LOGIN_DEV === "true";
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const sessionToken = safeSessionStorageGet(AUTH_TOKEN_SESSION_KEY)?.trim();
  if (sessionToken) return sessionToken;
  const cookieToken = readCookie(AUTH_TOKEN_COOKIE_KEY)?.trim();
  if (cookieToken) {
    safeSessionStorageSet(AUTH_TOKEN_SESSION_KEY, cookieToken);
    safeLocalStorageSet(AUTH_TOKEN_KEY, cookieToken);
    return cookieToken;
  }
  const fallbackToken = safeLocalStorageGet(AUTH_TOKEN_KEY)?.trim();
  if (!fallbackToken) return null;
  safeSessionStorageSet(AUTH_TOKEN_SESSION_KEY, fallbackToken);
  setCookie(AUTH_TOKEN_COOKIE_KEY, fallbackToken);
  return fallbackToken;
}

export const AUTH_CHANGE_EVENT = SHARED_AUTH_CHANGE_EVENT;
export const ASSISTANT_VOICE_CHANGE_EVENT = SHARED_ASSISTANT_VOICE_CHANGE_EVENT;

function dispatchAuthChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  safeSessionStorageSet(AUTH_TOKEN_SESSION_KEY, token);
  safeLocalStorageSet(AUTH_TOKEN_KEY, token);
  setCookie(AUTH_TOKEN_COOKIE_KEY, token);
  dispatchAuthChange();
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  safeLocalStorageRemove(AUTH_TOKEN_KEY);
  safeSessionStorageRemove(AUTH_TOKEN_SESSION_KEY);
  clearCookie(AUTH_TOKEN_COOKIE_KEY);
  dispatchAuthChange();
  try {
    const w = window as Window & {
      ReactNativeWebView?: { postMessage: (m: string) => void };
    };
    if (w.ReactNativeWebView) {
      w.ReactNativeWebView.postMessage(
        JSON.stringify({ type: NATIVE_BRIDGE_AUTH_CHANGE, token: "" })
      );
    }
  } catch {
    // ignore
  }
}

type JwtPayload = {
  sub?: unknown;
  email?: unknown;
};

function getDecodedTokenPayload(): JwtPayload | null {
  if (typeof window === "undefined") return null;
  const token = getStoredToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64Raw = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64Raw.length % 4)) % 4;
    const base64 = base64Raw + "=".repeat(padLen);
    const json = atob(base64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function getUserIdFromToken(): string | null {
  const payload = getDecodedTokenPayload();
  if (!payload) return null;
  return typeof payload.sub === "string" && payload.sub.trim()
    ? payload.sub.trim()
    : null;
}

export function getUserEmailFromToken(): string | null {
  const payload = getDecodedTokenPayload();
  if (!payload) return null;
  return typeof payload.email === "string" && payload.email.trim()
    ? payload.email.trim()
    : null;
}

export function getUserScopedStorageKey(
  prefix: string,
  legacyKey?: string
): string {
  const userId = getUserIdFromToken();
  return userId ? `${prefix}-${userId}` : (legacyKey ?? prefix);
}

export const USER_SAVED_DATA_STORAGE_KEYS = [
  "ideahome-ideas-list",
  "ideahome-bugs-list",
  "ideahome-todo-list",
  "ideahome-features-list",
  "ideahome-expenses",
  "ideahome-costs-expenses",
  "ideahome-project-nav-tab-order",
  "ideahome-project-nav-tabs-hidden",
] as const;

export function clearUserSavedData(): void {
  if (typeof window === "undefined") return;
  for (const k of USER_SAVED_DATA_STORAGE_KEYS) {
    safeLocalStorageRemove(k);
  }
}

export function isAuthenticated(): boolean {
  if (isSkipLoginDev()) return true;
  return Boolean(getStoredToken());
}

const OPENROUTER_MODEL_STORAGE_PREFIX = "ideahome-openrouter-model";
const OPENROUTER_MODEL_STORAGE_LEGACY_KEY = "ideahome-openrouter-model";

function getOpenRouterModelStorageKey(): string {
  return getUserScopedStorageKey(
    OPENROUTER_MODEL_STORAGE_PREFIX,
    OPENROUTER_MODEL_STORAGE_LEGACY_KEY
  );
}

export function getStoredOpenRouterModel(): string | null {
  if (typeof window === "undefined") return null;
  const value = safeLocalStorageGet(getOpenRouterModelStorageKey())?.trim();
  return value || null;
}

export function setStoredOpenRouterModel(model: string): void {
  if (typeof window === "undefined") return;
  const normalized = model.trim();
  if (!normalized) return;
  safeLocalStorageSet(getOpenRouterModelStorageKey(), normalized);
}

const ASSISTANT_VOICE_STORAGE_PREFIX = "ideahome-assistant-voice-uri";
const ASSISTANT_VOICE_STORAGE_LEGACY_KEY = "ideahome-assistant-voice-uri";

function getAssistantVoiceStorageKey(): string {
  return getUserScopedStorageKey(
    ASSISTANT_VOICE_STORAGE_PREFIX,
    ASSISTANT_VOICE_STORAGE_LEGACY_KEY
  );
}

export function getStoredAssistantVoiceUri(): string | null {
  if (typeof window === "undefined") return null;
  const value = safeLocalStorageGet(getAssistantVoiceStorageKey())?.trim();
  return value || null;
}

export function setStoredAssistantVoiceUri(voiceUri: string): void {
  if (typeof window === "undefined") return;
  const normalized = voiceUri.trim();
  if (!normalized) return;
  safeLocalStorageSet(getAssistantVoiceStorageKey(), normalized);
  window.dispatchEvent(new CustomEvent(ASSISTANT_VOICE_CHANGE_EVENT));
}

export function logout(redirectTo: string = "/login"): void {
  clearStoredToken();
  clearUserSavedData();
  if (typeof window === "undefined") return;
  window.location.href = redirectTo;
}
