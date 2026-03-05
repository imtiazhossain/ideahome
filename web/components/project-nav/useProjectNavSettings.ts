import { useCallback, useEffect, useRef, useState } from "react";
import { OPEN_SETTINGS_MENU_EVENT } from "./tab-order";

export function useProjectNavSettings() {
  const [settingsButtonVisible, setSettingsButtonVisible] = useState(true);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [reorderSectionOpen, setReorderSectionOpen] = useState(false);
  const [showTabsSectionOpen, setShowTabsSectionOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [deleteProjectSectionOpen, setDeleteProjectSectionOpen] =
    useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  const closeSettingsMenu = useCallback(() => {
    setSettingsMenuOpen(false);
    setShowTabsSectionOpen(false);
    setReorderSectionOpen(false);
    setAddSectionOpen(false);
    setDeleteProjectSectionOpen(false);
  }, []);

  useEffect(() => {
    const openSettingsMenu = () => {
      setSettingsButtonVisible(true);
      setSettingsMenuOpen(true);
      setShowTabsSectionOpen(false);
      setReorderSectionOpen(false);
      setAddSectionOpen(false);
      setDeleteProjectSectionOpen(false);
    };
    window.addEventListener(OPEN_SETTINGS_MENU_EVENT, openSettingsMenu);
    return () =>
      window.removeEventListener(OPEN_SETTINGS_MENU_EVENT, openSettingsMenu);
  }, []);

  return {
    settingsButtonVisible,
    setSettingsButtonVisible,
    settingsMenuOpen,
    setSettingsMenuOpen,
    reorderSectionOpen,
    setReorderSectionOpen,
    showTabsSectionOpen,
    setShowTabsSectionOpen,
    addSectionOpen,
    setAddSectionOpen,
    deleteProjectSectionOpen,
    setDeleteProjectSectionOpen,
    settingsMenuRef,
    closeSettingsMenu,
  };
}
