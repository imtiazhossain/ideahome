import React from "react";
import { Linking, Modal, Pressable, Text, View } from "react-native";
import { AppButton } from "./ui/AppButton";
import { appStyles } from "../theme/appStyles";

export type BulbyModalProps = {
  visible: boolean;
  onClose: () => void;
  webAppUrl: string;
};

export function BulbyModal({ visible, onClose, webAppUrl }: BulbyModalProps) {
  const s = appStyles;
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={s.modalHeader}>
            <Text style={s.title}>Bulby</Text>
            <AppButton label="Close" variant="secondary" onPress={onClose} />
          </View>
          <Text style={s.body}>
            Bulby is your AI assistant. For the full chat experience, open the web app.
          </Text>
          <AppButton
            label="Open web app"
            onPress={() => {
              Linking.openURL(webAppUrl).catch(() => {});
              onClose();
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
