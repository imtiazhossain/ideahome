import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import type { ShouldStartLoadRequestEvent } from "react-native-webview";
import { MOBILE_DEEP_LINK_REDIRECT_URI } from "@ideahome/shared-config";

export type AuthWebViewModalProps = {
  visible: boolean;
  authUrl: string;
  onRedirect: (url: string) => void;
  onClose: () => void;
};

/**
 * Modal WebView that loads the OAuth URL. When the backend redirects to
 * ideahome://auth?token=... (or ?error=...), we intercept, call onRedirect(url),
 * and prevent the WebView from loading the deep link so the user stays in the app.
 */
export function AuthWebViewModal({
  visible,
  authUrl,
  onRedirect,
  onClose,
}: AuthWebViewModalProps) {
  const onShouldStartLoadWithRequest = (event: ShouldStartLoadRequestEvent) => {
    const { url } = event.nativeEvent;
    if (url.startsWith(MOBILE_DEEP_LINK_REDIRECT_URI)) {
      onRedirect(url);
      return false;
    }
    return true;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Sign in</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Cancel</Text>
          </Pressable>
        </View>
        <WebView
          source={{ uri: authUrl }}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          originWhitelist={["https://*", "http://*", "ideahome://*"]}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Loading sign-in…</Text>
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeText: {
    fontSize: 16,
    color: "#1d4ed8",
    fontWeight: "500",
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
});
