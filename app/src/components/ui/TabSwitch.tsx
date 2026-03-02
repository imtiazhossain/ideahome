import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, radii, spacing } from "../../theme/tokens";

export function TabSwitch<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      contentContainerStyle={styles.row}
      showsHorizontalScrollIndicator={false}
      bounces={false}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.tab, active ? styles.tabActive : null]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const TAB_ACTIVE_COLOR = "#1d4ed8";

const styles = StyleSheet.create({
  row: {
    backgroundColor: "#ffffff",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tab: {
    borderRadius: radii.small,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: "relative",
  },
  tabActive: {
    borderBottomColor: TAB_ACTIVE_COLOR,
    borderBottomWidth: 2,
    marginBottom: -1,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
  tabTextActive: {
    color: TAB_ACTIVE_COLOR,
    fontWeight: "600",
  },
});
