import { APPEARANCE_PRESET_IDS, pathUsers, pathUsersMeAppearance } from "@ideahome/shared";
import type {
  AppearancePreferences as SharedAppearancePreferences,
  AppearancePresetId as SharedAppearancePresetId,
  User as SharedUser,
} from "@ideahome/shared";
import { requestJson } from "./http";

export type User = SharedUser;
export type AppearancePresetId = SharedAppearancePresetId;
export type AppearancePreferences = SharedAppearancePreferences;
export const APPEARANCE_PRESETS = APPEARANCE_PRESET_IDS;

export async function fetchUsers(): Promise<User[]> {
  return requestJson<User[]>(pathUsers(), {
    errorMessage: "Failed to fetch users",
  });
}

export async function fetchMyAppearancePrefs(): Promise<AppearancePreferences> {
  return requestJson<AppearancePreferences>(pathUsersMeAppearance(), {
    errorMessage: "Failed to fetch appearance preferences",
  });
}

export async function updateMyAppearancePrefs(input: {
  lightPreset: AppearancePresetId;
  darkPreset: AppearancePresetId;
}): Promise<AppearancePreferences> {
  return requestJson<AppearancePreferences>(pathUsersMeAppearance(), {
    method: "PUT",
    body: input,
    errorMessage: "Failed to save appearance preferences",
  });
}
