import React, { useEffect, useMemo, useRef, useState } from "react";
import { toYYYYMMDD } from "../lib/utils";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const PERIODS = ["AM", "PM"] as const;

type Period = (typeof PERIODS)[number];

export type UiDateTimePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  hasError?: boolean;
  className?: string;
  popupClassName?: string;
  showInlineLabel?: boolean;
};

type DateParts = {
  date: string;
  hour: string;
  minute: string;
  period: Period;
};

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

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
    cells.push({
      dateStr,
      day: d.getDate(),
      isCurrentMonth: d.getMonth() === viewMonth,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
    });
    dayIndex++;
  }
  return cells;
}

function fromDateTime(value: string): DateParts {
  if (!value) {
    const now = new Date();
    return {
      date: toYYYYMMDD(now),
      hour: "09",
      minute: "00",
      period: "AM",
    };
  }

  // Prefer explicit local datetime parsing to avoid timezone conversion surprises.
  const localMatch = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (localMatch) {
    const date = localMatch[1];
    const hour24 = Number.parseInt(localMatch[2], 10);
    const minute = localMatch[3];
    if (!Number.isNaN(hour24)) {
      const period: Period = hour24 >= 12 ? "PM" : "AM";
      const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
      return {
        date,
        hour: String(hour12).padStart(2, "0"),
        minute,
        period,
      };
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const now = new Date();
    return {
      date: toYYYYMMDD(now),
      hour: "09",
      minute: "00",
      period: "AM",
    };
  }

  const hour24 = parsed.getHours();
  const period: Period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    date: toYYYYMMDD(parsed),
    hour: String(hour12).padStart(2, "0"),
    minute: String(parsed.getMinutes()).padStart(2, "0"),
    period,
  };
}

function toDateTimeString(parts: DateParts): string {
  const parsedHour = Number.parseInt(parts.hour, 10);
  let hour24 = Number.isNaN(parsedHour) ? 9 : parsedHour % 12;
  if (parts.period === "PM") hour24 += 12;
  return `${parts.date}T${String(hour24).padStart(2, "0")}:${parts.minute}`;
}

function formatDisplayValue(value: string): string {
  if (!value) return "Select date & time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function UiDateTimePickerField({
  label,
  value,
  onChange,
  ariaLabel = "Select date and time",
  hasError = false,
  className,
  popupClassName,
  showInlineLabel = true,
}: UiDateTimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [openedValue, setOpenedValue] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLUListElement>(null);
  const minuteListRef = useRef<HTMLUListElement>(null);
  const periodListRef = useRef<HTMLUListElement>(null);

  const activeValue = open ? draftValue : value;
  const parts = useMemo(() => fromDateTime(activeValue), [activeValue]);
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const d = new Date(`${parts.date}T00:00:00`);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setDraftValue(value);
    setOpenedValue(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    hourListRef.current
      ?.querySelector(".calendar-event-datetime-time-item.is-selected")
      ?.scrollIntoView({ block: "center" });
    minuteListRef.current
      ?.querySelector(".calendar-event-datetime-time-item.is-selected")
      ?.scrollIntoView({ block: "center" });
    periodListRef.current
      ?.querySelector(".calendar-event-datetime-time-item.is-selected")
      ?.scrollIntoView({ block: "center" });
  }, [open, parts.hour, parts.minute, parts.period]);

  useEffect(() => {
    const d = new Date(`${parts.date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    setView({ year: d.getFullYear(), month: d.getMonth() });
  }, [parts.date]);

  const today = toYYYYMMDD(new Date());
  const cells = getCalendarCells(view.year, view.month, parts.date, today);

  const update = (next: Partial<DateParts>) => {
    const merged: DateParts = {
      date: next.date ?? parts.date,
      hour: next.hour ?? parts.hour,
      minute: next.minute ?? parts.minute,
      period: next.period ?? parts.period,
    };
    setDraftValue(toDateTimeString(merged));
  };
  const hasEdits = draftValue !== openedValue;

  return (
    <div
      ref={rootRef}
      className={cx("expenses-date-filter-dropdown ui-date-picker-field", className)}
    >
      <button
        type="button"
        className={cx(
          "expenses-input",
          "expenses-date-filter-trigger",
          "calendar-event-datetime-trigger",
          hasError && "is-error"
        )}
        onClick={() =>
          setOpen((v) => {
            const next = !v;
            if (next) {
              setDraftValue(value);
              setOpenedValue(value);
            }
            return next;
          })
        }
        aria-label={ariaLabel}
        aria-invalid={hasError || undefined}
        aria-expanded={open}
      >
        {showInlineLabel && (
          <span className="expenses-date-filter-trigger-label">{label}</span>
        )}
        <span className="expenses-date-filter-trigger-value">{formatDisplayValue(value)}</span>
      </button>
      {open && (
        <div className="calendar-picker-anchor">
          <div
            className={cx(
              "calendar-picker-popup",
              "calendar-event-datetime-popup",
              popupClassName
            )}
            role="dialog"
            aria-label={ariaLabel}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="calendar-picker-header calendar-event-datetime-header">
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

            <div className="calendar-event-datetime-layout">
              <div className="calendar-event-datetime-calendar">
                <div className="calendar-picker-weekdays">
                  {DAY_LABELS.map((labelText, index) => (
                    <span key={`${labelText}-${index}`} className="calendar-picker-weekday">
                      {labelText}
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
                      onClick={() => update({ date: cell.dateStr })}
                      aria-label={`${cell.dateStr}${cell.isSelected ? " selected" : ""}`}
                    >
                      {cell.day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="calendar-event-datetime-time">
                <ul
                  ref={hourListRef}
                  className="calendar-event-datetime-time-list"
                  aria-label="Select hour"
                >
                  {HOURS.map((hour) => (
                    <li key={hour}>
                      <button
                        type="button"
                        className={
                          "calendar-event-datetime-time-item" +
                          (parts.hour === hour ? " is-selected" : "")
                        }
                        onClick={() => update({ hour })}
                      >
                        {hour}
                      </button>
                    </li>
                  ))}
                </ul>
                <ul
                  ref={minuteListRef}
                  className="calendar-event-datetime-time-list"
                  aria-label="Select minute"
                >
                  {MINUTES.map((minute) => (
                    <li key={minute}>
                      <button
                        type="button"
                        className={
                          "calendar-event-datetime-time-item" +
                          (parts.minute === minute ? " is-selected" : "")
                        }
                        onClick={() => update({ minute })}
                      >
                        {minute}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="calendar-event-datetime-period-column">
                  <ul
                    ref={periodListRef}
                    className="calendar-event-datetime-time-list"
                    aria-label="Select AM/PM"
                  >
                    {PERIODS.map((period) => (
                      <li key={period}>
                        <button
                          type="button"
                          className={
                            "calendar-event-datetime-time-item" +
                            (parts.period === period ? " is-selected" : "")
                          }
                          onClick={() => update({ period })}
                        >
                          {period}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="calendar-event-datetime-actions">
                    <button
                      type="button"
                      className="calendar-event-datetime-action-btn"
                      onClick={() => {
                        const now = new Date();
                        const next: DateParts = {
                          date: toYYYYMMDD(now),
                          hour: parts.hour || "09",
                          minute: parts.minute || "00",
                          period: parts.period || "AM",
                        };
                        setDraftValue(toDateTimeString(next));
                      }}
                    >
                      Today
                    </button>
                    {hasEdits && (
                      <button
                        type="button"
                        className="calendar-event-datetime-action-btn calendar-event-datetime-action-btn-primary"
                        onClick={() => {
                          onChange(draftValue);
                          setOpen(false);
                        }}
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
