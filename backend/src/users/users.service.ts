import { BadRequestException, Injectable } from "@nestjs/common";
import {
  APPEARANCE_PRESET_IDS,
  type AppearancePreferences,
  type AppearancePresetId,
} from "@ideahome/shared-config";
import { PrismaService } from "../prisma.service";

const APPEARANCE_PREFS_VERSION = 1;
const DEFAULT_APPEARANCE_PRESET: AppearancePresetId = "classic";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAppearancePresetId(value: unknown): value is AppearancePresetId {
  return (
    typeof value === "string" &&
    (APPEARANCE_PRESET_IDS as readonly string[]).includes(value)
  );
}

function buildDefaultAppearancePreferences(): AppearancePreferences {
  return {
    version: APPEARANCE_PREFS_VERSION,
    lightPreset: DEFAULT_APPEARANCE_PRESET,
    darkPreset: DEFAULT_APPEARANCE_PRESET,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeAppearancePreferences(raw: unknown): AppearancePreferences {
  const defaults = buildDefaultAppearancePreferences();
  if (!isPlainObject(raw)) return defaults;
  const lightPreset = isAppearancePresetId(raw.lightPreset)
    ? raw.lightPreset
    : defaults.lightPreset;
  const darkPreset = isAppearancePresetId(raw.darkPreset)
    ? raw.darkPreset
    : defaults.darkPreset;
  const updatedAt =
    typeof raw.updatedAt === "string" && raw.updatedAt.trim()
      ? raw.updatedAt
      : defaults.updatedAt;
  return {
    version: APPEARANCE_PREFS_VERSION,
    lightPreset,
    darkPreset,
    updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    let orgId = me?.organizationId ?? null;
    if (!orgId) {
      const membership = await this.prisma.organizationMembership.findFirst({
        where: { userId },
        select: { organizationId: true },
        orderBy: { createdAt: "asc" },
      });
      orgId = membership?.organizationId ?? null;
    }
    if (!orgId) return [];
    return this.prisma.user.findMany({
      where: {
        OR: [
          { organizationId: orgId },
          { organizationMemberships: { some: { organizationId: orgId } } },
        ],
      },
      orderBy: { email: "asc" },
      select: { id: true, email: true, name: true },
    });
  }

  async getAppearancePreferences(userId: string): Promise<AppearancePreferences> {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { appearancePrefs: true },
    });
    return normalizeAppearancePreferences(me?.appearancePrefs);
  }

  async updateAppearancePreferences(
    userId: string,
    input: { lightPreset?: unknown; darkPreset?: unknown }
  ): Promise<AppearancePreferences> {
    if (!isAppearancePresetId(input.lightPreset)) {
      throw new BadRequestException("Invalid lightPreset");
    }
    if (!isAppearancePresetId(input.darkPreset)) {
      throw new BadRequestException("Invalid darkPreset");
    }

    const next: AppearancePreferences = {
      version: APPEARANCE_PREFS_VERSION,
      lightPreset: input.lightPreset,
      darkPreset: input.darkPreset,
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: { appearancePrefs: next },
    });
    return next;
  }
}
