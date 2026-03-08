import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibleModal } from "./AccessibleModal";
import { Button } from "./Button";
import {
  ColorPickerPopover,
  type ColorPickerRgb,
} from "./ColorPickerPopover";
import { ErrorBanner } from "./ErrorBanner";
import {
  CUSTOM_TAB_ICON_PRESETS,
  CustomTabIconPreview,
  RESERVED_CUSTOM_TAB_ICON_IDS,
  createGeneratedCustomTabIcon,
  createPresetCustomTabIcon,
  getRemoteIconUrl,
} from "./CustomTabIcon";
import type { CustomTabIcon, CustomTabKind } from "../lib/customTabs";

export interface CreateCustomTabModalSubmitValue {
  name: string;
  kind: CustomTabKind;
  icon: CustomTabIcon;
}

export interface CreateCustomTabModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: CreateCustomTabModalSubmitValue) => void | Promise<void>;
  usedIconIds?: string[];
}

const KIND_OPTIONS: Array<{ kind: CustomTabKind; label: string; description: string }> = [
  {
    kind: "list",
    label: "List",
    description: "Checklist-style page for quick task tracking.",
  },
  {
    kind: "page",
    label: "Page",
    description: "Standalone document page with rich text editing.",
  },
  {
    kind: "board",
    label: "Board",
    description: "Independent board with custom columns and cards.",
  },
];

const INITIALS_COLOR_PRESETS = [
  { id: "blue", label: "Blue", dot: "#60a5fa" },
  { id: "teal", label: "Teal", dot: "#22d3ee" },
  { id: "green", label: "Green", dot: "#a3e635" },
  { id: "amber", label: "Amber", dot: "#fbbf24" },
  { id: "rose", label: "Rose", dot: "#fb7185" },
  { id: "violet", label: "Violet", dot: "#a78bfa" },
] as const;

type ColorChannel = "r" | "g" | "b";
type RgbColor = ColorPickerRgb;

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex({ r, g, b }: RgbColor): string {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgb(value: string): RgbColor {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return { r: 37, g: 99, b: 235 };
  }
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function getOnlineIconLabel(iconId: string): string {
  const [, rawName = iconId] = iconId.split(":");
  return rawName
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function CreateCustomTabModal({
  open,
  onClose,
  onSubmit,
  usedIconIds = [],
}: CreateCustomTabModalProps) {
  const [kind, setKind] = useState<CustomTabKind>("list");
  const [name, setName] = useState("");
  const [iconChoice, setIconChoice] = useState("initials");
  const [hasManualIconChoice, setHasManualIconChoice] = useState(false);
  const [customInitials, setCustomInitials] = useState("");
  const [customColor, setCustomColor] = useState("#2563eb");
  const [customColorDraft, setCustomColorDraft] = useState<RgbColor>(
    hexToRgb("#2563eb")
  );
  const [customHexInput, setCustomHexInput] = useState("#2563EB");
  const [customColorEditorOpen, setCustomColorEditorOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [remoteOptions, setRemoteOptions] = useState<string[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const iconDropdownRef = useRef<HTMLDivElement | null>(null);
  const usedIconIdSet = useMemo(
    () => new Set([...RESERVED_CUSTOM_TAB_ICON_IDS, ...usedIconIds]),
    [usedIconIds]
  );

  useEffect(() => {
    if (!open) return;
    setKind("list");
    setName("");
    setIconChoice("initials");
    setHasManualIconChoice(false);
    setCustomInitials("");
    setCustomColor("#2563eb");
    setCustomColorDraft(hexToRgb("#2563eb"));
    setCustomHexInput("#2563EB");
    setCustomColorEditorOpen(false);
    setIconPickerOpen(false);
    setRemoteOptions([]);
    setRemoteLoading(false);
    setError(null);
    setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (iconChoice !== "initials") {
      setCustomColorEditorOpen(false);
    }
  }, [iconChoice]);

  useEffect(() => {
    if (!open) return;
    const query = name.trim();
    if (!query) {
      setRemoteOptions([]);
      setRemoteLoading(false);
      return;
    }
    const controller = new AbortController();
    setRemoteLoading(true);
    fetch(
      `https://api.iconify.design/search?query=${encodeURIComponent(
        query
      )}&limit=18`,
      { signal: controller.signal }
    )
      .then((response) => response.json())
      .then((payload: { icons?: unknown }) => {
        const icons = Array.isArray(payload.icons)
          ? payload.icons.filter((value): value is string => typeof value === "string")
          : [];
        const seen = new Set<string>();
        const uniqueIcons = icons.filter((iconId) => {
          if (usedIconIdSet.has(iconId)) return false;
          const rawName = iconId.split(":")[1] ?? iconId;
          const normalized = rawName
            .replace(/-(filled|fill|outline|outlined|line|solid|regular|round|sharp)$/i, "")
            .replace(/-[0-9]+$/i, "")
            .trim();
          if (!normalized || seen.has(normalized)) return false;
          seen.add(normalized);
          return true;
        });
        setRemoteOptions(uniqueIcons);
      })
      .catch(() => {
        setRemoteOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRemoteLoading(false);
      });
    return () => controller.abort();
  }, [name, open, usedIconIdSet]);

  useEffect(() => {
    if (!open || hasManualIconChoice) return;
    if (remoteOptions.length > 0) {
      setIconChoice(remoteOptions[0] ?? "initials");
      return;
    }
    setIconChoice("initials");
  }, [hasManualIconChoice, open, remoteOptions]);

  const availableBuiltInIcons = useMemo(
    () =>
      CUSTOM_TAB_ICON_PRESETS.filter((preset) => !usedIconIdSet.has(preset.id)),
    [usedIconIdSet]
  );

  const icon = useMemo<CustomTabIcon>(() => {
    if (iconChoice === "initials") {
      return createGeneratedCustomTabIcon(name, kind, {
        initials: customInitials,
        color: customColor,
      });
    }
    return createPresetCustomTabIcon(iconChoice, name, kind);
  }, [customColor, customInitials, iconChoice, kind, name]);

  const previewLabel = useMemo(() => {
    if (iconChoice === "initials") return "Initials";
    const preset = CUSTOM_TAB_ICON_PRESETS.find((entry) => entry.id === iconChoice);
    return preset ? `${preset.label} icon` : `${iconChoice} icon`;
  }, [iconChoice]);

  const selectedIconLabel = useMemo(() => {
    if (iconChoice === "initials") return "Initials";
    const preset = CUSTOM_TAB_ICON_PRESETS.find((entry) => entry.id === iconChoice);
    return preset?.label ?? getOnlineIconLabel(iconChoice);
  }, [iconChoice]);

  const customHexValue = useMemo(
    () => rgbToHex(customColorDraft).toUpperCase(),
    [customColorDraft]
  );
  const trimmedName = name.trim();

  useEffect(() => {
    setCustomHexInput(customColor.toUpperCase());
  }, [customColor]);

  useEffect(() => {
    if (!iconPickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (iconDropdownRef.current?.contains(target)) return;
      setIconPickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [iconPickerOpen]);

  return (
    <AccessibleModal open={open} onClose={onClose} title="Create Custom Tab">
      <form
        className="create-custom-tab-form"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmedName = name.trim();
          if (!trimmedName) {
            setError("Enter a name for the tab.");
            return;
          }
          setError(null);
          setSubmitting(true);
          Promise.resolve(
            onSubmit({
              name: trimmedName,
              kind,
              icon:
                icon.type === "generated"
                  ? createGeneratedCustomTabIcon(trimmedName, kind, {
                      initials: customInitials,
                      color: customColor,
                    })
                  : { ...icon, seed: trimmedName },
            })
          )
            .then(() => {
              setSubmitting(false);
            })
            .catch((submissionError) => {
              setSubmitting(false);
              setError(
                submissionError instanceof Error
                  ? submissionError.message
                  : "Could not create custom tab."
              );
            });
        }}
      >
        {error ? <ErrorBanner message={error} style={{ marginBottom: 16 }} /> : null}

        <div className="create-custom-tab-kind-grid" role="radiogroup" aria-label="Tab type">
          {KIND_OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              className={`create-custom-tab-kind${kind === option.kind ? " is-active" : ""}`}
              onClick={() => setKind(option.kind)}
              aria-pressed={kind === option.kind}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>

        <div className="form-group">
          <label htmlFor="create-custom-tab-name">Name</label>
          <input
            id="create-custom-tab-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Launch plan"
            autoFocus
          />
        </div>

        {trimmedName ? (
          <div className="create-custom-tab-icon-row">
          <div className="create-custom-tab-icon-preview">
            <span className="create-custom-tab-icon-label">Preview</span>
            <div className="create-custom-tab-icon-preview-box">
              <CustomTabIconPreview icon={icon} fallbackName={name || "New tab"} />
            </div>
            <span className="create-custom-tab-icon-meta">{previewLabel}</span>
          </div>

          <div className="create-custom-tab-icon-picker">
            <span className="create-custom-tab-icon-label">Icon</span>
            <div className="create-custom-tab-icon-actions">
              <div className="create-custom-tab-icon-dropdown" ref={iconDropdownRef}>
                <button
                  type="button"
                  className="expenses-input expenses-date-filter-trigger ui-menu-dropdown-trigger"
                  onClick={() => setIconPickerOpen((value) => !value)}
                  aria-haspopup="listbox"
                  aria-expanded={iconPickerOpen}
                  aria-label="Choose icon"
                >
                  <span className="create-custom-tab-icon-trigger">
                    <CustomTabIconPreview
                      icon={icon}
                      fallbackName={name || selectedIconLabel}
                    />
                    <span>{selectedIconLabel}</span>
                  </span>
                </button>
                {iconPickerOpen ? (
                  <div
                    className="expenses-category-dropdown-list ui-menu-dropdown-menu create-custom-tab-icon-menu"
                    role="listbox"
                  >
                    <div className="ui-menu-dropdown-group">
                      {remoteLoading
                        ? null
                        : (
                        remoteOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`expenses-category-dropdown-option ui-menu-dropdown-option${
                              iconChoice === option ? " is-selected" : ""
                            }`}
                            onClick={() => {
                              setHasManualIconChoice(true);
                              setIconChoice(option);
                              setIconPickerOpen(false);
                            }}
                          >
                            <span className="expenses-category-dropdown-option-text create-custom-tab-icon-option-label">
                              <span
                                className="custom-tab-icon custom-tab-icon--mask"
                                style={{
                                  WebkitMaskImage: `url(${getRemoteIconUrl(option)})`,
                                  maskImage: `url(${getRemoteIconUrl(option)})`,
                                }}
                                aria-hidden
                              >
                                <span className="custom-tab-icon-mask-fill" />
                              </span>
                              <span>{getOnlineIconLabel(option)}</span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="ui-menu-dropdown-group">
                      <button
                        type="button"
                        className={`expenses-category-dropdown-option ui-menu-dropdown-option${
                          iconChoice === "initials" ? " is-selected" : ""
                        }`}
                        onClick={() => {
                          setHasManualIconChoice(true);
                          setIconChoice("initials");
                          setIconPickerOpen(false);
                        }}
                      >
                        <span className="expenses-category-dropdown-option-text create-custom-tab-icon-option-label">
                          <CustomTabIconPreview
                            icon={createGeneratedCustomTabIcon(name, kind, {
                              initials: customInitials,
                              color: customColor,
                            })}
                            fallbackName={name || "Initials"}
                          />
                          <span>Initials</span>
                        </span>
                      </button>
                      {availableBuiltInIcons.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`expenses-category-dropdown-option ui-menu-dropdown-option${
                            iconChoice === preset.id ? " is-selected" : ""
                          }`}
                          onClick={() => {
                            setHasManualIconChoice(true);
                            setIconChoice(preset.id);
                            setIconPickerOpen(false);
                          }}
                        >
                          <span className="expenses-category-dropdown-option-text create-custom-tab-icon-option-label">
                            <CustomTabIconPreview
                              icon={createPresetCustomTabIcon(preset.id, name, kind)}
                              fallbackName={preset.label}
                            />
                            <span>{preset.label}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {iconChoice === "initials" ? (
              <div className="create-custom-tab-generated-controls">
                <label className="create-custom-tab-generated-field">
                  <span>Initials</span>
                  <input
                    type="text"
                    value={customInitials}
                    onChange={(event) =>
                      setCustomInitials(
                        event.target.value
                          .replace(/[^a-z0-9]/gi, "")
                          .toUpperCase()
                          .slice(0, 3)
                      )
                    }
                    placeholder="Auto"
                    maxLength={3}
                  />
                </label>
                <div className="create-custom-tab-generated-field create-custom-tab-color-picker">
                  <ColorPickerPopover
                    label="Color"
                    presets={INITIALS_COLOR_PRESETS}
                    value={customColor}
                    isCustomSelected={!INITIALS_COLOR_PRESETS.some(
                      (preset) =>
                        preset.dot.toUpperCase() === customColor.toUpperCase()
                    )}
                    customPanelOpen={customColorEditorOpen}
                    customHexInput={customHexInput}
                    customPreviewColor={customHexValue}
                    customDraft={customColorDraft}
                    customDoneLabel="Done"
                    onSelectPreset={(presetId) => {
                      const preset = INITIALS_COLOR_PRESETS.find(
                        (entry) => entry.id === presetId
                      );
                      if (!preset) return;
                      setCustomColor(preset.dot);
                      setCustomColorDraft(hexToRgb(preset.dot));
                      setCustomHexInput(preset.dot.toUpperCase());
                      setCustomColorEditorOpen(false);
                    }}
                    onToggleCustom={() => {
                      setCustomColorDraft(hexToRgb(customColor));
                      setCustomHexInput(customColor.toUpperCase());
                      setCustomColorEditorOpen((value) => !value);
                    }}
                    onCustomDraftChannel={(channel, value) => {
                      const next = {
                        ...customColorDraft,
                        [channel]: clampChannel(value),
                      };
                      setCustomColorDraft(next);
                      setCustomColor(rgbToHex(next));
                    }}
                    onCustomHexInputChange={(value) => {
                      const next = value.toUpperCase();
                      const normalized = next.startsWith("#") ? next : `#${next}`;
                      if (!/^#[0-9A-F]{0,6}$/.test(normalized)) return;
                      setCustomHexInput(normalized);
                      if (normalized.length === 7) {
                        setCustomColorDraft(hexToRgb(normalized.toLowerCase()));
                        setCustomColor(normalized.toLowerCase());
                      }
                    }}
                    onDoneCustom={() => setCustomColorEditorOpen(false)}
                    onDismissCustom={() => setCustomColorEditorOpen(false)}
                  />
                </div>
              </div>
            ) : null}
            <p className="create-custom-tab-icon-status" role="status">
              {iconChoice === "initials"
                ? "Using initials with your chosen text and color."
                : "Using the selected icon from the dropdown."}
            </p>
          </div>
          </div>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </AccessibleModal>
  );
}
