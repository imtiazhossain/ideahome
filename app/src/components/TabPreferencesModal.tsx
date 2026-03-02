import React from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Switch,
  Text,
  View,
} from "react-native";
import type { AppTab } from "../types";
import type { CustomList } from "../utils/customListsStorage";
import { AppButton } from "./ui/AppButton";
import { getTabLabel } from "../utils/tabLabels";
import { getCustomListTabId } from "../utils/customListsStorage";
import { appStyles } from "../theme/appStyles";

export type TabPreferencesModalProps = {
  visible: boolean;
  onClose: () => void;
  fullTabOrder: AppTab[];
  hiddenTabIds: string[];
  setTabOrder: (order: AppTab[]) => void;
  setHiddenTabIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  customLists: CustomList[];
};

function moveIndex<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function TabPreferencesModal({
  visible,
  onClose,
  fullTabOrder,
  hiddenTabIds,
  setTabOrder,
  setHiddenTabIds,
  customLists,
}: TabPreferencesModalProps) {
  const s = appStyles;

  const toggleHidden = (tabId: string) => {
    setHiddenTabIds((prev) =>
      prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId]
    );
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setTabOrder(moveIndex(fullTabOrder, index, index - 1));
  };

  const moveDown = (index: number) => {
    if (index >= fullTabOrder.length - 1) return;
    setTabOrder(moveIndex(fullTabOrder, index, index + 1));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={s.modalHeader}>
            <Text style={s.title}>Customize tabs</Text>
            <AppButton label="Done" onPress={onClose} />
          </View>
          <Text style={s.subtle}>
            Reorder with Up/Down. Toggle Hide to remove a tab from the bar.
          </Text>
          <FlatList
            data={fullTabOrder}
            keyExtractor={(id) => id}
            style={{ maxHeight: 400 }}
            renderItem={({ item: tabId, index }) => {
              const label = getTabLabel(
                tabId,
                customLists.find((l) => getCustomListTabId(l.slug) === tabId)?.name
              );
              const isHidden = hiddenTabIds.includes(tabId);
              return (
                <View style={s.inlineRowWrap}>
                  <Text style={[s.body, isHidden && { opacity: 0.6 }]} numberOfLines={1}>
                    {label}
                  </Text>
                  <View style={s.inlineRow}>
                    <AppButton
                      label="Up"
                      variant="secondary"
                      onPress={() => moveUp(index)}
                      disabled={index === 0}
                    />
                    <AppButton
                      label="Down"
                      variant="secondary"
                      onPress={() => moveDown(index)}
                      disabled={index === fullTabOrder.length - 1}
                    />
                    <Text style={s.subtle}>Hide</Text>
                    <Switch
                      value={isHidden}
                      onValueChange={() => toggleHidden(tabId)}
                    />
                  </View>
                </View>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
