import React, { memo } from "react";
import { View, Text } from "react-native";
import { AppCard } from "../components/ui/AppCard";
import { appStyles } from "../theme/appStyles";

export type ComingSoonTabProps = {
  title: string;
};

export const ComingSoonTab = memo(function ComingSoonTab({ title }: ComingSoonTabProps) {
  const s = appStyles;
  return (
    <View style={s.stack}>
      <AppCard title={title}>
        <Text style={s.body}>This section is coming soon.</Text>
        <Text style={s.subtle}>It exists on the web app but is not yet available in the mobile app.</Text>
      </AppCard>
    </View>
  );
});
