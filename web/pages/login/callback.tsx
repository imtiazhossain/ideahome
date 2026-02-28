import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import {
  AUTH_PARAM_ERROR,
  AUTH_PARAM_TOKEN,
  JUST_LOGGED_IN_SESSION_KEY,
  readUrlParam,
  sanitizeAuthToken,
} from "@ideahome/shared-config";
import {
  setStoredToken,
  clearStoredToken,
  getUserScopedStorageKey,
} from "../../lib/api";

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function LoginCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const href = typeof window !== "undefined" ? window.location.href : "";
    const tokenFromUrl = sanitizeAuthToken(readUrlParam(href, AUTH_PARAM_TOKEN));
    const errorFromUrl = readUrlParam(href, AUTH_PARAM_ERROR);
    const { token, error } = router.query;
    const tokenFromQuery =
      typeof token === "string" ? sanitizeAuthToken(token) : "";
    const errorFromQuery =
      typeof error === "string" ? safeDecodeURIComponent(error).trim() : "";
    const resolvedError = errorFromUrl || errorFromQuery || null;
    if (resolvedError) {
      clearStoredToken();
      setErrorMessage(resolvedError);
      setStatus("error");
      return;
    }
    const resolvedToken = tokenFromUrl || tokenFromQuery;
    if (resolvedToken) {
      setStoredToken(resolvedToken);
      try {
        const selectedProjectLegacyKey = "ideahome-selected-project-id";
        localStorage.removeItem(
          getUserScopedStorageKey(
            selectedProjectLegacyKey,
            selectedProjectLegacyKey
          )
        );
        localStorage.removeItem(selectedProjectLegacyKey);
        sessionStorage.setItem(JUST_LOGGED_IN_SESSION_KEY, "1");
      } catch {
        // ignore
      }
      setStatus("done");
      router.replace("/", undefined, { shallow: false });
      return;
    }
    setErrorMessage("Missing token from login.");
    setStatus("error");
  }, [router.isReady, router.query, router]);

  return (
    <>
      <Head>
        <title>Signing in — Idea Home</title>
      </Head>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "var(--bg-page)",
          color: "var(--text)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            padding: 32,
            background: "var(--bg-card)",
            borderRadius: "var(--card-radius)",
            boxShadow: "var(--card-shadow)",
            border: "1px solid var(--border)",
            textAlign: "center",
          }}
        >
          {status === "loading" && (
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              Signing you in…
            </p>
          )}
          {status === "done" && (
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              Redirecting…
            </p>
          )}
          {status === "error" && (
            <>
              <p
                style={{
                  margin: "0 0 16px",
                  color: "var(--trend-down)",
                  fontSize: 14,
                }}
              >
                {errorMessage ?? "Sign-in failed."}
              </p>
              <Link
                href="/login"
                style={{
                  display: "inline-block",
                  padding: "10px 16px",
                  background: "var(--accent)",
                  color: "var(--bg-page)",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Try again
              </Link>
              <p
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                <Link href="/" style={{ color: "var(--accent)" }}>
                  ← Back to app
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
