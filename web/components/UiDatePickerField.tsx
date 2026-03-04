import React, { useEffect, useRef, useState } from "react";
import { CalendarPickerPopup } from "./CalendarPickerPopup";

export type UiDatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  popupClassName?: string;
};

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Design-system date picker trigger for new pages.
 * Reuses Finances dropdown trigger + shared CalendarPickerPopup.
 */
export function UiDatePickerField({
  label,
  value,
  onChange,
  ariaLabel = "Select date",
  className,
  popupClassName,
}: UiDatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const display = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString()
    : "Select date";

  return (
    <div
      ref={containerRef}
      className={cx("expenses-date-filter-dropdown ui-date-picker-field", className)}
    >
      <button
        type="button"
        className="expenses-input expenses-date-filter-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        <span className="expenses-date-filter-trigger-label">{label}</span>
        <span className="expenses-date-filter-trigger-value">{display}</span>
      </button>
      {open && (
        <div className="calendar-picker-anchor">
          <CalendarPickerPopup
            value={value}
            onChange={(next) => {
              if (!next) return;
              onChange(next);
            }}
            onClose={() => setOpen(false)}
            ariaLabel={ariaLabel}
            className={popupClassName}
          />
        </div>
      )}
    </div>
  );
}
