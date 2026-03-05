import {
  API_REQUEST_HEADER as SHARED_API_REQUEST_HEADER,
  pathSupportErrorReport,
} from "@ideahome/shared";
import { clearStoredToken, getStoredToken, isSkipLoginDev } from "./auth";

/** Header sent on all API requests so Next.js rewrites only proxy these (not page navigation). */
export const API_REQUEST_HEADER = SHARED_API_REQUEST_HEADER;
export const BACKEND_CONNECTIVITY_CHANGE_EVENT =
  "ideahome-backend-connectivity-change";

function readPublicEnv(name: string): string | undefined {
  const maybeProcess = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  return maybeProcess?.env?.[name];
}

const API_BASE_RAW = readPublicEnv("NEXT_PUBLIC_API_URL") || "";
const API_BASE_DEFAULT = "http://localhost:3001";

function resolveApiBase(raw: string): string {
  if (!raw) return API_BASE_DEFAULT;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return API_BASE_DEFAULT;
    }
    return raw.replace(/\/$/, "");
  } catch {
    return API_BASE_DEFAULT;
  }
}

const API_BASE_RESOLVED = resolveApiBase(API_BASE_RAW);

let backendOffline = false;
let unauthorizedBlocked = false;

function dispatchBackendConnectivityChange(offline: boolean): void {
  if (backendOffline === offline) return;
  backendOffline = offline;
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BACKEND_CONNECTIVITY_CHANGE_EVENT, {
      detail: { offline, at: Date.now() },
    })
  );
}

export function isBackendOffline(): boolean {
  return backendOffline;
}

function handleUnauthorizedResponse(): void {
  if (typeof window === "undefined") return;
  if (isSkipLoginDev()) {
    clearStoredToken();
    return;
  }
  if (unauthorizedBlocked) return;
  unauthorizedBlocked = true;
  clearStoredToken();
  window.location.replace("/login");
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function resetUnauthorizedBlock(): void {
  unauthorizedBlocked = false;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (unauthorizedBlocked && !getStoredToken()) {
    throw new Error("Unauthorized");
  }
  const headers = new Headers(init?.headers);
  headers.set(API_REQUEST_HEADER, "1");
  Object.entries(authHeaders()).forEach(([k, v]) => headers.set(k, v));
  try {
    const response = await fetch(input, { ...init, headers });
    dispatchBackendConnectivityChange(false);
    if (response.status === 401) {
      handleUnauthorizedResponse();
    }
    return response;
  } catch (err) {
    if (isLikelyNetworkFetchError(err)) {
      dispatchBackendConnectivityChange(true);
    }
    throw err;
  }
}

function isLikelyNetworkFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err instanceof TypeError) return true;
  return /failed to fetch|networkerror|load failed/i.test(err.message);
}

function getMobileDevApiBase(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname))
    return `http://${hostname}:3001`;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname))
    return `http://${hostname}:3001`;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname))
    return `http://${hostname}:3001`;
  return null;
}

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const mobileBase = getMobileDevApiBase();
    if (mobileBase) return mobileBase;
    const host = window.location.hostname;
    if (!API_BASE_RAW) {
      if (host !== "localhost" && host !== "127.0.0.1") {
        return "";
      }
    }
    if (
      (API_BASE_RESOLVED === "http://localhost:3001" ||
        API_BASE_RESOLVED === "http://127.0.0.1:3001") &&
      host !== "localhost" &&
      host !== "127.0.0.1"
    ) {
      return "";
    }
    if (window.location.origin === API_BASE_RESOLVED) return "";
  }
  return API_BASE_RESOLVED;
}

export const API_BASE = API_BASE_RESOLVED;

export async function readResponseMessage(r: Response): Promise<string | null> {
  try {
    const text = await r.text();
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      const body = JSON.parse(trimmed) as { message?: string | string[] };
      if (typeof body?.message === "string" && body.message.trim()) {
        return body.message.trim();
      }
      if (Array.isArray(body?.message)) {
        const parts = body.message
          .filter((part): part is string => typeof part === "string")
          .map((part) => part.trim())
          .filter(Boolean);
        if (parts.length > 0) return parts.join(", ");
      }
    } catch {
      return trimmed.slice(0, 300);
    }
  } catch {
    // Ignore read/parse errors.
  }
  return null;
}

async function throwFromResponse(
  r: Response,
  defaultMessage: string
): Promise<never> {
  let message = (await readResponseMessage(r)) ?? defaultMessage;
  if (message === defaultMessage && r.status > 0) {
    message = `${defaultMessage} (${r.status})`;
  }
  throw new Error(message);
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
  errorMessage: string;
};

function buildRequestInit(options: RequestOptions): RequestInit {
  const { method, body, headers } = options;
  const mergedHeaders = new Headers(headers);
  if (body !== undefined && !mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }
  return {
    ...(method ? { method } : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(Array.from(mergedHeaders.keys()).length > 0
      ? { headers: mergedHeaders }
      : {}),
  };
}

export async function requestJson<T>(
  path: string,
  options: RequestOptions
): Promise<T> {
  const r = await apiFetch(`${getApiBase()}${path}`, buildRequestInit(options));
  if (!r.ok) await throwFromResponse(r, options.errorMessage);
  return r.json();
}

export async function requestBlob(
  path: string,
  options: RequestOptions
): Promise<Blob> {
  const r = await apiFetch(`${getApiBase()}${path}`, buildRequestInit(options));
  if (!r.ok) await throwFromResponse(r, options.errorMessage);
  return r.blob();
}

export async function requestVoid(
  path: string,
  options: RequestOptions
): Promise<void> {
  const r = await apiFetch(`${getApiBase()}${path}`, buildRequestInit(options));
  if (!r.ok) await throwFromResponse(r, options.errorMessage);
}

export async function sendErrorReportEmail(body: {
  errorMessage: string;
  pageUrl?: string;
}): Promise<void> {
  return requestVoid(pathSupportErrorReport(), {
    method: "POST",
    body,
    errorMessage: "Failed to send error report",
  });
}
