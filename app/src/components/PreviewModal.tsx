import React from "react";
import { Modal, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { AppButton } from "./ui/AppButton";
import { appStyles } from "../theme/appStyles";

type PreviewModalProps = {
  visible: boolean;
  url: string;
  title: string;
  token: string;
  onClose: () => void;
};

export function PreviewModal({
  visible,
  url,
  title,
  token,
  onClose,
}: PreviewModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={appStyles.previewOverlay}>
        <View style={appStyles.previewCard}>
          <View style={appStyles.topBar}>
            <Text style={appStyles.listItemTitle}>{title || "Preview"}</Text>
            <AppButton label="Close" variant="secondary" onPress={onClose} />
          </View>
          {url ? (
            <WebView
              source={{
                uri: url,
                headers: { Authorization: `Bearer ${token}` },
              }}
              style={appStyles.previewWebView}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
