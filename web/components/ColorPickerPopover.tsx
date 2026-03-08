import React from "react";
import { Button } from "./Button";
import { UiInput } from "./UiInput";

export type ColorPickerChannel = "r" | "g" | "b";

export type ColorPickerRgb = Record<ColorPickerChannel, number>;

export interface ColorPickerPreset {
  id: string;
  label: string;
  dot: string;
}

export interface ColorPickerPopoverProps {
  label?: string;
  presets: readonly ColorPickerPreset[];
  value: string;
  isCustomSelected: boolean;
  customPanelOpen: boolean;
  customPanelTitle?: string;
  customHexInput: string;
  customPreviewColor: string;
  customDraft: ColorPickerRgb;
  customDoneLabel?: string;
  customCancelLabel?: string;
  showCancelButton?: boolean;
  onSelectPreset: (presetId: string) => void;
  onToggleCustom: () => void;
  onCustomDraftChannel: (channel: ColorPickerChannel, value: number) => void;
  onCustomHexInputChange: (value: string) => void;
  onDoneCustom?: () => void;
  onCancelCustom?: () => void;
  onDismissCustom?: () => void;
}

export function ColorPickerPopover({
  label,
  presets,
  value,
  isCustomSelected,
  customPanelOpen,
  customPanelTitle = "Custom color",
  customHexInput,
  customPreviewColor,
  customDraft,
  customDoneLabel = "Done",
  customCancelLabel = "Cancel",
  showCancelButton = false,
  onSelectPreset,
  onToggleCustom,
  onCustomDraftChannel,
  onCustomHexInputChange,
  onDoneCustom,
  onCancelCustom,
  onDismissCustom,
}: ColorPickerPopoverProps) {
  const hexInputId = React.useId();
  const customWrapRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!customPanelOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (customWrapRef.current?.contains(target)) return;
      onDismissCustom?.();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [customPanelOpen, onDismissCustom]);

  return (
    <div className="ui-color-picker">
      {label ? <span className="ui-color-picker-label">{label}</span> : null}
      <div className="ui-color-picker-swatches">
        {presets.map((preset) => {
          const selected = value.toUpperCase() === preset.dot.toUpperCase();
          return (
            <button
              key={preset.id}
              type="button"
              className={`ui-color-swatch${selected ? " is-selected" : ""}`}
              aria-label={`${preset.label} color`}
              aria-pressed={selected}
              title={preset.label}
              style={{ background: preset.dot }}
              onClick={() => onSelectPreset(preset.id)}
            />
          );
        })}
        <div className="ui-color-picker-custom-wrap" ref={customWrapRef}>
          <button
            type="button"
            className={`ui-color-swatch ui-color-swatch-custom${
              isCustomSelected ? " is-selected" : ""
            }`}
            aria-label="Choose custom color"
            aria-pressed={isCustomSelected}
            title="Custom Color"
            onClick={onToggleCustom}
          >
            <span className="ui-color-swatch-custom-inner" />
          </button>
          {customPanelOpen ? (
            <div className="ui-color-picker-panel">
              <div className="ui-color-picker-panel-header">
                <span>{customPanelTitle}</span>
                <span
                  className="ui-color-picker-panel-preview"
                  style={{ background: customPreviewColor }}
                />
              </div>
              <div className="ui-color-picker-panel-sliders">
                {(
                  [
                    ["R", "r"],
                    ["G", "g"],
                    ["B", "b"],
                  ] as const
                ).map(([sliderLabel, channel]) => (
                  <label key={channel} className="ui-color-picker-panel-slider">
                    <span>{sliderLabel}</span>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={customDraft[channel]}
                      onChange={(event) =>
                        onCustomDraftChannel(channel, Number(event.target.value))
                      }
                    />
                    <strong>{customDraft[channel]}</strong>
                  </label>
                ))}
              </div>
              <div className="ui-color-picker-panel-hex">
                <label htmlFor={hexInputId}>Hex</label>
                <UiInput
                  id={hexInputId}
                  value={customHexInput}
                  onChange={(event) => onCustomHexInputChange(event.target.value)}
                  className="ui-color-picker-panel-input"
                  style={{ width: "10ch" }}
                />
              </div>
              <div className="ui-color-picker-panel-actions">
                {showCancelButton && onCancelCustom ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onCancelCustom}
                  >
                    {customCancelLabel}
                  </Button>
                ) : null}
                {onDoneCustom ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onDoneCustom}
                  >
                    {customDoneLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
