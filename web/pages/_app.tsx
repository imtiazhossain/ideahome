import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { TabOrderProvider, getFirstVisibleTabHref } from "../components/ProjectNavBar";
import { SelectedProjectProvider } from "../lib/SelectedProjectContext";
import { ThemeProvider } from "../lib/ThemeContext";
import "../styles/globals.css";

export { useTheme } from "../lib/ThemeContext";

function RedirectToFirstTab({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    if (router.pathname !== "/" || !router.isReady) return;
    const firstHref = getFirstVisibleTabHref();
    if (firstHref !== "/") router.replace(firstHref);
  }, [router.pathname, router.isReady]);
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
