import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { clearStoredToken, setStoredToken } from "../../../lib/api";
import {
  AUTH_PARAM_ERROR,
  AUTH_PARAM_REDIRECT_URI,
  AUTH_PARAM_TOKEN,
  MOBILE_DEEP_LINK_REDIRECT_URI,
  NATIVE_BRIDGE_AUTH_CHANGE,
  NATIVE_BRIDGE_AUTH_ERROR,
  readUrlParam,
  sanitizeAuthToken,
} from "@ideahome/shared";
import type {
  NativeBridgeAuthChangePayload,
  NativeBridgeAuthErrorPayload,
} from "@ideahome/shared";

type CallbackStatus = "loading" | "done" | "error";

type NativeBridgePayload =
  | NativeBridgeAuthChangePayload
  | NativeBridgeAuthErrorPayload;

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
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
    const expectedProtocol = new URL(MOBILE_DEEP_LINK_REDIRECT_URI).protocol;
    if (parsed.protocol !== expectedProtocol) return "";
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

    const token = sanitizeAuthToken(readUrlParam(window.location.href, AUTH_PARAM_TOKEN));
    const error = readUrlParam(window.location.href, AUTH_PARAM_ERROR);
    const redirectUri = normalizeAppRedirectUri(
      readUrlParam(window.location.href, AUTH_PARAM_REDIRECT_URI)
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
      notifyNative({ type: NATIVE_BRIDGE_AUTH_ERROR, error });
      notifyNative({ type: NATIVE_BRIDGE_AUTH_CHANGE, token: "" });
      setMessage(error);
      setStatus("error");
      openAppWithParams({ [AUTH_PARAM_ERROR]: error });
      return;
    }

    if (!token) {
      const fallback = "Missing token from mobile auth callback";
      notifyNative({ type: NATIVE_BRIDGE_AUTH_ERROR, error: fallback });
      setMessage(fallback);
      setStatus("error");
      openAppWithParams({ [AUTH_PARAM_ERROR]: fallback });
      return;
    }

    setStoredToken(token);
    notifyNative({ type: NATIVE_BRIDGE_AUTH_CHANGE, token });
    if (openAppWithParams({ [AUTH_PARAM_TOKEN]: token })) {
      setMessage(
        "Returning to Idea Home app. If it does not open automatically, use the button below."
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
        <title>Signing in — Idea Home</title>
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
              <p style={{ margin: 0 }}>{message || "Redirecting to Idea Home…"}</p>
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
                  Open Idea Home App
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
                  Return to Idea Home App
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
