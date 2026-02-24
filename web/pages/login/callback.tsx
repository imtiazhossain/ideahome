import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { setStoredToken, clearStoredToken } from "../../lib/api";

export default function LoginCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const { token, error } = router.query;
    if (typeof error === "string") {
      clearStoredToken();
      setErrorMessage(decodeURIComponent(error));
      setStatus("error");
      return;
    }
    if (typeof token === "string" && token) {
      setStoredToken(token);
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
