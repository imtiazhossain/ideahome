import React, { useRef } from "react";
import { Alert, Modal, Pressable, StatusBar, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "./ui/AppButton";
import { WebAppView, type WebAppViewHandle } from "./WebAppView";
import { appStyles } from "../theme/appStyles";
import { colors, spacing } from "../theme/tokens";
import type { AppState } from "../hooks/useAppState";

export type AppMainProps = {
  state: AppState;
  showTabPrefsModal: boolean;
  setShowTabPrefsModal: (v: boolean) => void;
  showBulbyModal: boolean;
  setShowBulbyModal: (v: boolean) => void;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
};

export function AppMain({
  state,
  drawerOpen,
  setDrawerOpen,
}: AppMainProps) {
  const {
    token,
    signOutInProgress,
    signOutNative,
    disableAuthBypass,
    setSignOutInProgress,
  } = state;

  const webViewRef = useRef<WebAppViewHandle>(null);

  const handleSignOut = () => {
    if (!token) {
      disableAuthBypass().catch(() => {
        Alert.alert("Unable to disable test mode");
      });
      return;
    }
    setSignOutInProgress(true);
    setDrawerOpen(false);
    signOutNative()
      .catch(() => {
        Alert.alert("Unable to clear session");
      })
      .finally(() => setSignOutInProgress(false));
  };

  return (
    <SafeAreaView style={appStyles.screen} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" />

      <View style={appStyles.topBar}>
        <Pressable
          onPress={() => setDrawerOpen(true)}
          style={{ paddingVertical: 8, paddingRight: 12 }}
          accessibilityLabel="Open menu"
        >
          <Text style={{ fontSize: 22, color: colors.accent }}>☰</Text>
        </Pressable>
        <Text style={[appStyles.brand, { flex: 1, marginHorizontal: 8 }]} numberOfLines={1}>
          Idea Home
        </Text>
        <AppButton
          label={
            signOutInProgress
              ? "Signing out..."
              : token
                ? "Sign out"
                : "Exit test mode"
          }
          variant="secondary"
          disabled={signOutInProgress}
          onPress={handleSignOut}
        />
      </View>

      <WebAppView
        ref={webViewRef}
        token={token ?? ""}
        onSignOut={() => {
          setDrawerOpen(false);
          state.setSignOutInProgress(true);
          signOutNative()
            .catch(() => {})
            .finally(() => state.setSignOutInProgress(false));
        }}
      />

      <Modal
        visible={drawerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={menuStyles.overlay}>
          <View style={menuStyles.panel}>
            <View style={menuStyles.header}>
              <Text style={menuStyles.title}>Idea Home</Text>
              <AppButton
                label="Close"
                variant="secondary"
                onPress={() => setDrawerOpen(false)}
              />
            </View>
            <View style={menuStyles.actions}>
              <AppButton
                label="Refresh web"
                variant="secondary"
                onPress={() => {
                  webViewRef.current?.reload();
                  setDrawerOpen(false);
                }}
              />
              <AppButton
                label={token ? "Sign out" : "Exit test mode"}
                variant="secondary"
                disabled={signOutInProgress}
                onPress={handleSignOut}
              />
            </View>
          </View>
          <Pressable
            style={menuStyles.backdrop}
            onPress={() => setDrawerOpen(false)}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const menuStyles = {
  overlay: {
    flex: 1,
    flexDirection: "row" as const,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  panel: {
    width: 280,
    backgroundColor: colors.bgCard,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    padding: spacing.md,
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: colors.accentStrong,
  },
  actions: {
    gap: spacing.sm,
  },
};
