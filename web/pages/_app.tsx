import React from "react";
import type { AppProps } from "next/app";
import { TabOrderProvider } from "../components/ProjectNavBar";
import { SelectedProjectProvider } from "../lib/SelectedProjectContext";
import { ThemeProvider } from "../lib/ThemeContext";
import "../styles/globals.css";

export { useTheme } from "../lib/ThemeContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <SelectedProjectProvider>
        <TabOrderProvider>
          <Component {...pageProps} />
        </TabOrderProvider>
      </SelectedProjectProvider>
    </ThemeProvider>
  );
}
