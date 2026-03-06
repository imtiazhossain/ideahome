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
const USERS_ME_BULBY_MEMORY_PATH = "/users/me/bulby-memory";

export type BulbyOrgContext = {
  product: string;
  architecture: string;
  apps: string[];
  coreDomains: string[];
  stack: string[];
  constraints: string[];
};

export type BulbyMemoryPreferences = {
  version: number;
  systemPrompt: string;
  orgContext: BulbyOrgContext;
  notes: string[];
  ruleEntries: BulbyRuleEntry[];
  rulesFileMarkdown: string;
  updatedAtIso: string;
};

export type BulbyRuleEntry = {
  id: string;
  kind: "learning" | "rule" | "action";
  title: string;
  detail: string;
  createdAtIso: string;
};

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

export async function fetchMyBulbyMemoryPrefs(): Promise<BulbyMemoryPreferences> {
  return requestJson<BulbyMemoryPreferences>(USERS_ME_BULBY_MEMORY_PATH, {
    errorMessage: "Failed to fetch Bulby memory",
  });
}

export async function updateMyBulbyMemoryPrefs(input: {
  systemPrompt?: string;
  orgContext?: Partial<BulbyOrgContext>;
  notes?: string[];
  appendNote?: string;
  appendRuleEntry?: {
    kind?: BulbyRuleEntry["kind"];
    title?: string;
    detail?: string;
  };
}): Promise<BulbyMemoryPreferences> {
  return requestJson<BulbyMemoryPreferences>(USERS_ME_BULBY_MEMORY_PATH, {
    method: "PUT",
    body: input,
    errorMessage: "Failed to save Bulby memory",
  });
}
