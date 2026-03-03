import React, { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { setStoredToken } from "../lib/api";
import { sanitizeAuthToken } from "@ideahome/shared";

/**
 * One-time entry for the native app WebView: read token from query, store it, redirect to /.
 * The iOS/Android app loads APP_WEB_URL/mobile-app?token=... so the web app sees the user as logged in.
 */
export default function MobileAppPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || typeof window === "undefined") return;
    const raw = typeof router.query.token === "string" ? router.query.token : "";
    const token = sanitizeAuthToken(raw);
    if (token) {
      setStoredToken(token);
    }
    router.replace("/");
  }, [router, router.isReady, router.query.token]);

  return (
    <>
      <Head>
        <title>Idea Home</title>
      </Head>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-page)",
          color: "var(--text)",
        }}
      >
        <p style={{ margin: 0 }}>Loading…</p>
      </div>
    </>
  );
}
