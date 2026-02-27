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
  const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const hashParams = new URLSearchParams(hash);
  const fromHash = hashParams.get(key)?.trim() ?? "";
  if (fromHash) return fromHash;
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const queryParams = new URLSearchParams(query);
  return queryParams.get(key)?.trim() ?? "";
}

function notifyNative(payload: NativeBridgePayload): void {
  if (typeof window === "undefined") return;
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
  } catch {
    // Ignore bridge posting errors.
  }
}

export default function MobileAuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!router.isReady || typeof window === "undefined") return;

    const token = readValue(window.location.href, "token");
    const error = readValue(window.location.href, "error");

    if (error) {
      clearStoredToken();
      notifyNative({ type: "auth-error", error });
      notifyNative({ type: "auth-change", token: "" });
      setMessage(error);
      setStatus("error");
      return;
    }

    if (!token) {
      const fallback = "Missing token from mobile auth callback";
      notifyNative({ type: "auth-error", error: fallback });
      setMessage(fallback);
      setStatus("error");
      return;
    }

    setStoredToken(token);
    notifyNative({ type: "auth-change", token });
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
          {status === "done" && <p style={{ margin: 0 }}>Redirecting to IdeaHome…</p>}
          {status === "error" && (
            <>
              <p style={{ margin: "0 0 10px", color: "var(--trend-down)" }}>
                Mobile sign-in failed
              </p>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
                {message}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
