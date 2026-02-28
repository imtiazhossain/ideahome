import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii } from "../../theme/tokens";

export function AppButton({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <Pressable
      style={[
        styles.button,
        variant === "primary" ? styles.primary : styles.secondary,
        disabled ? styles.disabled : null,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={variant === "primary" ? styles.primaryText : styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: radii.control,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primary: {
    backgroundColor: colors.accentStrong,
  },
  secondary: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderWidth: 1,
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
});
