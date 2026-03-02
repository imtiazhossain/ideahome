import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  TabOrderProvider,
  getFirstVisibleTabHref,
  useIsMobile,
  EXPLICIT_BOARD_SESSION_KEY,
} from "../components/ProjectNavBar";
import {
  SelectedProjectProvider,
  useSelectedProject,
} from "../lib/SelectedProjectContext";
import { ThemeProvider } from "../lib/ThemeContext";
import "../styles/globals.css";

export { useTheme } from "../lib/ThemeContext";

function RedirectToFirstTab({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { selectedProjectId } = useSelectedProject();
  const isMobile = useIsMobile();
  useEffect(() => {
    if (router.pathname !== "/") {
      try {
        sessionStorage.removeItem(EXPLICIT_BOARD_SESSION_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    if (!router.isReady) return;
    try {
      if (sessionStorage.getItem(EXPLICIT_BOARD_SESSION_KEY)) {
        sessionStorage.removeItem(EXPLICIT_BOARD_SESSION_KEY);
        return;
      }
    } catch {
      /* ignore */
    }
    // Without a selected project, redirecting to list pages can cause a loop
    // back to "/" (those pages redirect home when no project exists).
    if (!selectedProjectId) return;
    const firstHref = getFirstVisibleTabHref(
      isMobile ? ["code"] : undefined
    );
    if (firstHref !== "/") router.replace(firstHref);
  }, [router.pathname, router.isReady, selectedProjectId, isMobile]);
  return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon.svg" />
      </Head>
      <SelectedProjectProvider>
        <TabOrderProvider>
          <RedirectToFirstTab>
            <Component {...pageProps} />
          </RedirectToFirstTab>
        </TabOrderProvider>
      </SelectedProjectProvider>
    </ThemeProvider>
  );
}
