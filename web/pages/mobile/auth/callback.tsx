import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { clearStoredToken, setStoredToken } from "../../../lib/api";

type CallbackStatus = "loading" | "done" | "error";

type NativeBridgePayload =
  | { type: "auth-change"; token: string }
  | { type: "auth-error"; error: string };

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

function readValue(url: string, key: string): string {
  if (!url) return "";
  const safeUrl = url.trim();
  if (!safeUrl) return "";

  try {
    const parsed = new URL(safeUrl);
    const queryValue = parsed.searchParams.get(key)?.trim() ?? "";
    if (queryValue) return queryValue;
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    const hashParams = new URLSearchParams(hash);
    return hashParams.get(key)?.trim() ?? "";
  } catch {
    const withoutHash = safeUrl.includes("#")
      ? safeUrl.slice(0, safeUrl.indexOf("#"))
      : safeUrl;
    const query = withoutHash.includes("?")
      ? withoutHash.slice(withoutHash.indexOf("?") + 1)
      : "";
    const queryParams = new URLSearchParams(query);
    const queryValue = queryParams.get(key)?.trim() ?? "";
    if (queryValue) return queryValue;
    const hash = safeUrl.includes("#")
      ? safeUrl.slice(safeUrl.indexOf("#") + 1)
      : "";
    const hashParams = new URLSearchParams(hash);
    return hashParams.get(key)?.trim() ?? "";
  }
}

function sanitizeToken(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";
  return trimmed.replace(/#+$/g, "");
}

function notifyNative(payload: NativeBridgePayload): void {
  if (typeof window === "undefined") return;
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
  } catch {
    // Ignore bridge posting errors.
  }
}

function normalizeAppRedirectUri(rawValue: string): string {
  const candidate = rawValue.trim();
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "ideahome:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function appendQueryParams(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (!value) return;
    url.searchParams.set(key, value);
  });
  return url.toString();
}

export default function MobileAuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [message, setMessage] = useState("");
  const [deepLinkUrl, setDeepLinkUrl] = useState("");

  useEffect(() => {
    if (!router.isReady || typeof window === "undefined") return;

    const token = sanitizeToken(readValue(window.location.href, "token"));
    const error = readValue(window.location.href, "error");
    const redirectUri = normalizeAppRedirectUri(
      readValue(window.location.href, "redirect_uri")
    );

    const openAppWithParams = (params: Record<string, string>): boolean => {
      if (!redirectUri) return false;
      const nextAppUrl = appendQueryParams(redirectUri, params);
      setDeepLinkUrl(nextAppUrl);
      window.location.assign(nextAppUrl);
      return true;
    };

    if (error) {
      clearStoredToken();
      notifyNative({ type: "auth-error", error });
      notifyNative({ type: "auth-change", token: "" });
      setMessage(error);
      setStatus("error");
      openAppWithParams({ error });
      return;
    }

    if (!token) {
      const fallback = "Missing token from mobile auth callback";
      notifyNative({ type: "auth-error", error: fallback });
      setMessage(fallback);
      setStatus("error");
      openAppWithParams({ error: fallback });
      return;
    }

    setStoredToken(token);
    notifyNative({ type: "auth-change", token });
    if (openAppWithParams({ token })) {
      setMessage(
        "Returning to IdeaHome app. If it does not open automatically, use the button below."
      );
      setStatus("done");
      return;
    }

    setStatus("done");
    router.replace("/");
  }, [router, router.isReady]);

  return (
    <>
      <Head>
        <title>Signing in — IdeaHome</title>
      </Head>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-page)",
          color: "var(--text)",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--bg-card)",
            boxShadow: "var(--card-shadow)",
            padding: 24,
            textAlign: "center",
          }}
        >
          {status === "loading" && <p style={{ margin: 0 }}>Signing you in…</p>}
          {status === "done" && (
            <>
              <p style={{ margin: 0 }}>{message || "Redirecting to IdeaHome…"}</p>
              {deepLinkUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    window.location.assign(deepLinkUrl);
                  }}
                  style={{
                    marginTop: 14,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--button-bg)",
                    color: "var(--button-text)",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Open IdeaHome App
                </button>
              ) : null}
            </>
          )}
          {status === "error" && (
            <>
              <p style={{ margin: "0 0 10px", color: "var(--trend-down)" }}>
                Mobile sign-in failed
              </p>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
                {message}
              </p>
              {deepLinkUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    window.location.assign(deepLinkUrl);
                  }}
                  style={{
                    marginTop: 14,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--button-bg)",
                    color: "var(--button-text)",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Return to IdeaHome App
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
