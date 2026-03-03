import React, { useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewErrorEvent, WebViewMessageEvent } from "react-native-webview";
import { NATIVE_BRIDGE_AUTH_CHANGE } from "@ideahome/shared";
import { APP_WEB_URL } from "../constants";

export type WebAppViewProps = {
  token: string;
  onSignOut: () => void;
  webUrl?: string;
};

export type WebAppViewHandle = {
  reload: () => void;
};

export const WebAppView = React.forwardRef<WebAppViewHandle, WebAppViewProps>(
  function WebAppView(
    { token, onSignOut, webUrl = APP_WEB_URL },
    ref
  ) {
    const webViewRef = useRef<WebView>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      reload() {
        setLoadError(null);
        setLoading(true);
        webViewRef.current?.reload();
      },
    }));

    const baseUrl = webUrl.replace(/\/$/, "");
    const uri = token
      ? `${baseUrl}/mobile-app?token=${encodeURIComponent(token)}`
      : baseUrl;

    const onLoadStart = useCallback(() => {
      setLoading(true);
      setLoadError(null);
    }, []);

    const onLoadEnd = useCallback(() => {
      setLoading(false);
    }, []);

    const onError = useCallback((event: WebViewErrorEvent) => {
      setLoading(false);
      const { description, code } = event.nativeEvent;
      setLoadError(description || `Load failed (${code})`);
    }, []);

    const onMessage = React.useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const data = event.nativeEvent.data;
          if (typeof data !== "string") return;
          const payload = JSON.parse(data) as { type?: string; token?: string };
          if (
            payload.type === NATIVE_BRIDGE_AUTH_CHANGE &&
            (payload.token === "" || payload.token == null)
          ) {
            onSignOut();
          }
        } catch {
          // ignore malformed messages
        }
      },
      [onSignOut]
    );

    const source = useMemo(() => ({ uri }), [uri]);

    const handleRetry = useCallback(() => {
      setLoadError(null);
      setLoading(true);
      webViewRef.current?.reload();
    }, []);

    return (
      <View style={styles.fill}>
        <WebView
          ref={webViewRef}
          source={source}
          onMessage={onMessage}
          onLoadStart={onLoadStart}
          onLoadEnd={onLoadEnd}
          onError={onError}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          originWhitelist={["https://*", "http://*"]}
          allowFileAccess
          mixedContentMode="compatibility"
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        />
        {loading ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator size="large" />
            <Text style={styles.overlayText}>Loading…</Text>
          </View>
        ) : null}
        {loadError ? (
          <View style={styles.overlay}>
            <Text style={styles.errorText}>Could not connect to the server.</Text>
            <Text style={styles.errorHint}>
              Trying: {baseUrl}
            </Text>
            <Text style={styles.errorHint}>
              Run `pnpm dev:web` on your Mac. If this is a LAN URL, use the same Wi‑Fi on phone and Mac, then reload this app (shake → Reload).
            </Text>
            <Pressable style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  overlayText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
  errorHint: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#1d4ed8",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
