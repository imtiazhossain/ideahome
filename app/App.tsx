import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "./src/components/ui/AppButton";
import { AuthWebViewModal } from "./src/components/AuthWebViewModal";
import { appStyles } from "./src/theme/appStyles";
import { useAppState } from "./src/hooks/useAppState";
import { AppMain } from "./src/components/AppMain";

export default function App() {
  const state = useAppState();
  const {
    initializing,
    token,
    authBypassEnabled,
    authInProgress,
    signOutInProgress,
    authErrorMessage,
    signIn,
    enableAuthBypass,
    showAuthWebView,
    authUrlForWebView,
    handleAuthRedirectFromWebView,
    closeAuthWebView,
  } = state;

  const [showTabPrefsModal, setShowTabPrefsModal] = useState(false);
  const [showBulbyModal, setShowBulbyModal] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const content = initializing ? (
    <SafeAreaView style={appStyles.screen}>
        <StatusBar barStyle="dark-content" />
        <View style={appStyles.centeredFill}>
          <ActivityIndicator />
          <Text style={appStyles.subtle}>Loading session...</Text>
        </View>
      </SafeAreaView>
  ) : !token && !authBypassEnabled ? (
    <SafeAreaView style={appStyles.screen}>
        <StatusBar barStyle="dark-content" />
        <View style={appStyles.authContainer}>
          <Text style={appStyles.title}>Idea Home</Text>
          <Text style={appStyles.body}>Sign in with Google to continue. You’ll stay in the app.</Text>
          <AppButton
            label={authInProgress ? "Signing in..." : "Continue with Google"}
            disabled={authInProgress}
            onPress={() => {
              signIn("google").catch(() => {});
            }}
          />
          <AppButton
            label="Continue without login (testing)"
            variant="secondary"
            onPress={() => {
              enableAuthBypass().catch(() => {
                Alert.alert("Unable to enable test mode");
              });
            }}
          />
          {authErrorMessage ? <Text style={appStyles.errorText}>{authErrorMessage}</Text> : null}
        </View>
      </SafeAreaView>
  ) : (
    <AppMain
      state={state}
      showTabPrefsModal={showTabPrefsModal}
      setShowTabPrefsModal={setShowTabPrefsModal}
      showBulbyModal={showBulbyModal}
      setShowBulbyModal={setShowBulbyModal}
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
    />
  );

  return (
    <SafeAreaProvider style={appStyles.screen}>
      {content}
      <AuthWebViewModal
        visible={showAuthWebView && !!authUrlForWebView}
        authUrl={authUrlForWebView}
        onRedirect={handleAuthRedirectFromWebView}
        onClose={closeAuthWebView}
      />
    </SafeAreaProvider>
  );
}
