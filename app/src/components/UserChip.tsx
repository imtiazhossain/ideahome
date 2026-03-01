import React, { memo } from "react";
import { Pressable, Text } from "react-native";
import { appStyles } from "../theme/appStyles";

type UserChipProps = {
  userId: string;
  label: string;
  isSelected: boolean;
  onSelect: (userId: string) => void;
};

export const UserChip = memo(function UserChip({
  userId,
  label,
  isSelected,
  onSelect,
}: UserChipProps) {
  const s = appStyles;
  return (
    <Pressable
      style={[s.chip, isSelected ? s.chipActive : null]}
      onPress={() => onSelect(userId)}
    >
      <Text style={[s.chipText, isSelected ? s.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
});
