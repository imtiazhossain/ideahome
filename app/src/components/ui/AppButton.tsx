import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii } from "../../theme/tokens";

export function AppButton({
  label,
  onPress,
  disabled,
  variant = "primary",
  circular,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "add";
  circular?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.button,
        variant === "primary" ? styles.primary : variant === "add" ? styles.add : styles.secondary,
        disabled ? styles.disabled : null,
        circular ? styles.circular : null,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        style={
          variant === "primary"
            ? styles.primaryText
            : variant === "add"
              ? styles.addText
              : styles.secondaryText
        }
      >
        {label}
      </Text>
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
  circular: {
    width: 36,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.accentDark,
  },
  secondary: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderWidth: 1,
  },
  add: {
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderColor: "rgba(96, 165, 250, 0.8)",
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
  addText: {
    color: "#bfdbfe",
    fontSize: 16,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
});
