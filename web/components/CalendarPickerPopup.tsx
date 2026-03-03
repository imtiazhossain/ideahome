import React, { useEffect, useState } from "react";
import { toYYYYMMDD } from "../lib/utils";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getCalendarCells(
  viewYear: number,
  viewMonth: number,
  selectedDate: string,
  today: string
): { dateStr: string; day: number; isCurrentMonth: boolean; isToday: boolean; isSelected: boolean }[] {
  const first = new Date(viewYear, viewMonth, 1);
  const firstDayOfWeek = first.getDay();
  const cells: { dateStr: string; day: number; isCurrentMonth: boolean; isToday: boolean; isSelected: boolean }[] = [];
  const totalCells = 42;
  let dayIndex = 1 - firstDayOfWeek;
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(viewYear, viewMonth, dayIndex);
    const dateStr = toYYYYMMDD(d);
    const isCurrentMonth = d.getMonth() === viewMonth;
    cells.push({
      dateStr,
      day: d.getDate(),
      isCurrentMonth,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
    });
    dayIndex++;
  }
  return cells;
}

export interface CalendarPickerPopupProps {
  /** Current value as YYYY-MM-DD (empty string = no selection). */
  value: string;
  /** Called when user selects a date (and optionally when clearing or choosing Today). */
  onChange: (dateStr: string) => void;
  /** Called when the user picks a date, Clear, or Today (close the popup from parent). */
  onClose?: () => void;
  showClear?: boolean;
  showToday?: boolean;
  /** Initial view when opened; defaults to value or today. */
  initialView?: { year: number; month: number };
  ariaLabel?: string;
}

/**
 * Shared calendar popup for single-date selection. Use inside a positioned container
 * (e.g. position: relative) so the popup positions correctly. All calendar pickers
 * in the app use this component for consistent styling.
 */
export function CalendarPickerPopup({
  value,
  onChange,
  onClose,
  showClear = true,
  showToday = true,
  initialView,
  ariaLabel = "Calendar",
}: CalendarPickerPopupProps) {
  const today = toYYYYMMDD(new Date());
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    if (initialView) return initialView;
    if (value) {
      const d = new Date(`${value}T00:00:00`);
      if (!Number.isNaN(d.getTime()))
        return { year: d.getFullYear(), month: d.getMonth() };
    }
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  // When value changes externally (e.g. opening for a different field), sync view
  useEffect(() => {
    if (initialView) {
      setView(initialView);
      return;
    }
    if (value) {
      const d = new Date(`${value}T00:00:00`);
      if (!Number.isNaN(d.getTime()))
        setView({ year: d.getFullYear(), month: d.getMonth() });
    } else {
      const n = new Date();
      setView({ year: n.getFullYear(), month: n.getMonth() });
    }
  }, [value, initialView]);

  const cells = getCalendarCells(view.year, view.month, value, today);

  const handleSelect = (dateStr: string) => {
    onChange(dateStr);
    onClose?.();
  };

  return (
    <div
      className="calendar-picker-popup"
      role="dialog"
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="calendar-picker-header">
        <span className="calendar-picker-month-year">
          {MONTH_NAMES[view.month]} {view.year}
        </span>
        <div className="calendar-picker-nav">
          <button
            type="button"
            className="calendar-picker-nav-btn"
            onClick={() =>
              setView((v) =>
                v.month === 0
                  ? { year: v.year - 1, month: 11 }
                  : { year: v.year, month: v.month - 1 }
              )
            }
            aria-label="Previous month"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button
            type="button"
            className="calendar-picker-nav-btn"
            onClick={() =>
              setView((v) =>
                v.month === 11
                  ? { year: v.year + 1, month: 0 }
                  : { year: v.year, month: v.month + 1 }
              )
            }
            aria-label="Next month"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>
      <div className="calendar-picker-weekdays">
        {DAY_LABELS.map((label) => (
          <span key={label} className="calendar-picker-weekday">
            {label}
          </span>
        ))}
      </div>
      <div className="calendar-picker-grid">
        {cells.map((cell) => (
          <button
            key={cell.dateStr}
            type="button"
            className={
              "calendar-picker-day" +
              (cell.isCurrentMonth ? "" : " is-other-month") +
              (cell.isToday ? " is-today" : "") +
              (cell.isSelected ? " is-selected" : "")
            }
            onClick={() => handleSelect(cell.dateStr)}
            aria-label={`${cell.dateStr}${cell.isSelected ? " selected" : ""}`}
          >
            {cell.day}
          </button>
        ))}
      </div>
      {(showClear || showToday) && (
        <div className="calendar-picker-footer">
          {showClear && (
            <button
              type="button"
              className="calendar-picker-footer-btn"
              onClick={() => {
                onChange("");
                onClose?.();
              }}
            >
              Clear
            </button>
          )}
          {showToday && (
            <button
              type="button"
              className="calendar-picker-footer-btn"
              onClick={() => {
                onChange(today);
                onClose?.();
              }}
            >
              Today
            </button>
          )}
        </div>
      )}
    </div>
  );
}
