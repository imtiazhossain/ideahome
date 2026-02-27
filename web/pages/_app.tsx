import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import {
  TabOrderProvider,
  getFirstVisibleTabHref,
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
    const firstHref = getFirstVisibleTabHref();
    if (firstHref !== "/") router.replace(firstHref);
  }, [router.pathname, router.isReady, selectedProjectId]);
  return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
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
