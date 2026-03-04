import React, { useCallback, useEffect, useRef, useState } from "react";
import { CalendarPickerPopup } from "./CalendarPickerPopup";
import { IconChevronDown } from "./icons/IconChevronDown";
import { IconChevronRight } from "./icons/IconChevronRight";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type DateFilterMode = "all" | "day" | "dayOfMonth" | "month" | "year" | "range";

function formatDayLabel(dateStr: string): string {
  if (!dateStr) return "Select date";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function dayOfMonthOrdinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

function getTriggerLabel(
  mode: DateFilterMode,
  filterDay: string,
  filterDayOfMonth: number,
  filterMonth: number,
  filterYear: number,
  rangeStart: string,
  rangeEnd: string
): string {
  if (mode === "all") return "All time";
  if (mode === "day") return formatDayLabel(filterDay);
  if (mode === "dayOfMonth") return `${dayOfMonthOrdinal(filterDayOfMonth)} of every month`;
  if (mode === "month") return `${MONTH_NAMES[filterMonth - 1]} ${filterYear}`;
  if (mode === "year") return String(filterYear);
  return `${rangeStart} – ${rangeEnd}`;
}

const YEARS = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

export interface ExpensesDateFilterDropdownProps {
  mode: DateFilterMode;
  filterDay: string;
  filterDayOfMonth: number;
  filterMonth: number;
  filterYear: number;
  rangeStart: string;
  rangeEnd: string;
  onModeChange: (mode: DateFilterMode) => void;
  onFilterDayChange: (value: string) => void;
  onFilterDayOfMonthChange: (day: number) => void;
  onFilterMonthChange: (month: number) => void;
  onFilterYearChange: (year: number) => void;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExpensesDateFilterDropdown({
  mode,
  filterDay,
  filterDayOfMonth,
  filterMonth,
  filterYear,
  rangeStart,
  rangeEnd,
  onModeChange,
  onFilterDayChange,
  onFilterDayOfMonthChange,
  onFilterMonthChange,
  onFilterYearChange,
  onRangeStartChange,
  onRangeEndChange,
  open,
  onOpenChange,
}: ExpensesDateFilterDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dayOfMonthListRef = useRef<HTMLUListElement>(null);
  const monthListRef = useRef<HTMLUListElement>(null);
  const yearListRef = useRef<HTMLUListElement>(null);
  const [openSubPicker, setOpenSubPicker] = useState<"month" | "year" | "dayOfMonth" | null>(null);
  const [openCalendar, setOpenCalendar] = useState<"day" | "rangeStart" | "rangeEnd" | null>(null);

  const [draftMode, setDraftMode] = useState<DateFilterMode>(mode);
  const [draftFilterDay, setDraftFilterDay] = useState(filterDay);
  const [draftFilterDayOfMonth, setDraftFilterDayOfMonth] = useState(filterDayOfMonth);
  const [draftFilterMonth, setDraftFilterMonth] = useState(filterMonth);
  const [draftFilterYear, setDraftFilterYear] = useState(filterYear);
  const [draftRangeStart, setDraftRangeStart] = useState(rangeStart);
  const [draftRangeEnd, setDraftRangeEnd] = useState(rangeEnd);

  useEffect(() => {
    if (open) {
      setDraftMode(mode);
      setDraftFilterDay(filterDay);
      setDraftFilterDayOfMonth(filterDayOfMonth);
      setDraftFilterMonth(filterMonth);
      setDraftFilterYear(filterYear);
      setDraftRangeStart(rangeStart);
      setDraftRangeEnd(rangeEnd);
    }
  }, [open, mode, filterDay, filterDayOfMonth, filterMonth, filterYear, rangeStart, rangeEnd]);

  const applyDraftAndClose = useCallback(() => {
    onModeChange(draftMode);
    onFilterDayChange(draftFilterDay);
    onFilterDayOfMonthChange(draftFilterDayOfMonth);
    onFilterMonthChange(draftFilterMonth);
    onFilterYearChange(draftFilterYear);
    onRangeStartChange(draftRangeStart);
    onRangeEndChange(draftRangeEnd);
    onOpenChange(false);
  }, [
    draftMode,
    draftFilterDay,
    draftFilterDayOfMonth,
    draftFilterMonth,
    draftFilterYear,
    draftRangeStart,
    draftRangeEnd,
    onModeChange,
    onFilterDayChange,
    onFilterDayOfMonthChange,
    onFilterMonthChange,
    onFilterYearChange,
    onRangeStartChange,
    onRangeEndChange,
    onOpenChange,
  ]);

  useEffect(() => {
    if (!open) {
      setOpenSubPicker(null);
      setOpenCalendar(null);
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        applyDraftAndClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, applyDraftAndClose]);

  // When a sub-picker list opens, scroll so the selected option is centered
  useEffect(() => {
    if (openSubPicker === "dayOfMonth" && dayOfMonthListRef.current) {
      const selected = dayOfMonthListRef.current.querySelector(".is-selected");
      selected?.scrollIntoView({ block: "center" });
    } else if (openSubPicker === "month" && monthListRef.current) {
      const selected = monthListRef.current.querySelector(".is-selected");
      selected?.scrollIntoView({ block: "center" });
    } else if (openSubPicker === "year" && yearListRef.current) {
      const selected = yearListRef.current.querySelector(".is-selected");
      selected?.scrollIntoView({ block: "center" });
    }
  }, [openSubPicker]);

  const triggerLabel = getTriggerLabel(mode, filterDay, filterDayOfMonth, filterMonth, filterYear, rangeStart, rangeEnd);

  const selectAllTime = () => {
    onModeChange("all");
    onOpenChange(false);
  };

  return (
    <div
      ref={containerRef}
      className="expenses-date-filter-dropdown"
      role="group"
      aria-label="Filter by date"
    >
      <button
        type="button"
        className="expenses-input expenses-date-filter-trigger"
        onClick={() => (open ? applyDraftAndClose() : onOpenChange(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Date filter: ${triggerLabel}`}
      >
        <span className="expenses-date-filter-trigger-label">Date</span>
        <span className="expenses-date-filter-trigger-value">{triggerLabel}</span>
        <span
          className={"expenses-date-filter-trigger-chevron" + (open ? " is-open" : "")}
          aria-hidden
        >
          <IconChevronDown />
        </span>
      </button>
      {open && (
        <div
          className={
            "expenses-date-filter-menu" +
            (draftMode !== "all" ? " expenses-date-filter-menu-has-submenu" : "")
          }
          role="menu"
          aria-label="Date filter options"
        >
          <div className="expenses-date-filter-menu-main">
            <button
              type="button"
              role="menuitem"
              className={
                "expenses-date-filter-menu-item" + (draftMode === "all" ? " is-selected" : "")
              }
              onClick={selectAllTime}
            >
              All time
            </button>
            <button
              type="button"
              role="menuitem"
              className={
                "expenses-date-filter-menu-item expenses-date-filter-menu-item-has-submenu" +
                (draftMode === "day" ? " is-selected" : "")
              }
              onClick={() => setDraftMode("day")}
              aria-haspopup="true"
              aria-expanded={draftMode === "day"}
            >
              <span>By day</span>
              <IconChevronRight />
            </button>
            <button
              type="button"
              role="menuitem"
              className={
                "expenses-date-filter-menu-item expenses-date-filter-menu-item-has-submenu" +
                (draftMode === "month" ? " is-selected" : "")
              }
              onClick={() => setDraftMode("month")}
              aria-haspopup="true"
              aria-expanded={draftMode === "month"}
            >
              <span>By month</span>
              <IconChevronRight />
            </button>
            <button
              type="button"
              role="menuitem"
              className={
                "expenses-date-filter-menu-item expenses-date-filter-menu-item-has-submenu" +
                (draftMode === "year" ? " is-selected" : "")
              }
              onClick={() => setDraftMode("year")}
              aria-haspopup="true"
              aria-expanded={draftMode === "year"}
            >
              <span>By year</span>
              <IconChevronRight />
            </button>
            <button
              type="button"
              role="menuitem"
              className={
                "expenses-date-filter-menu-item expenses-date-filter-menu-item-has-submenu" +
                (draftMode === "range" ? " is-selected" : "")
              }
              onClick={() => setDraftMode("range")}
              aria-haspopup="true"
              aria-expanded={draftMode === "range"}
            >
              <span>Date range</span>
              <IconChevronRight />
            </button>
            <button
              type="button"
              role="menuitem"
              className={
                "expenses-date-filter-menu-item expenses-date-filter-menu-item-has-submenu" +
                (draftMode === "dayOfMonth" ? " is-selected" : "")
              }
              onClick={() => setDraftMode("dayOfMonth")}
              aria-haspopup="true"
              aria-expanded={draftMode === "dayOfMonth"}
            >
              <span>Day of month</span>
              <IconChevronRight />
            </button>
          </div>
          {draftMode !== "all" && (
          <div
            className="expenses-date-filter-submenu"
            onClick={() => {
              setOpenSubPicker(null);
              setOpenCalendar(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (openSubPicker !== null || openCalendar !== null) {
                  setOpenSubPicker(null);
                  setOpenCalendar(null);
                } else {
                  applyDraftAndClose();
                }
              }
            }}
          >
            {draftMode === "day" && (
              <div className="expenses-date-filter-submenu-content calendar-picker-anchor" role="group" aria-label="Select day">
                <button
                  type="button"
                  className="expenses-date-filter-submenu-input"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenCalendar((v) => (v === "day" ? null : "day"));
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={openCalendar === "day"}
                  aria-label="Date"
                >
                  {formatDayLabel(draftFilterDay)}
                </button>
                {openCalendar === "day" && (
                  <CalendarPickerPopup
                    value={draftFilterDay}
                    onChange={(dateStr) => {
                      setDraftFilterDay(dateStr);
                      setOpenCalendar(null);
                    }}
                    onClose={() => setOpenCalendar(null)}
                    showToday
                    ariaLabel="Select day"
                  />
                )}
              </div>
            )}
            {draftMode === "dayOfMonth" && (
              <div className="expenses-date-filter-submenu-content" role="group" aria-label="Select day of month">
                <div className="expenses-date-filter-submenu-picker">
                  <button
                    type="button"
                    className="expenses-date-filter-submenu-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenSubPicker((v) => (v === "dayOfMonth" ? null : "dayOfMonth"));
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={openSubPicker === "dayOfMonth"}
                    aria-label="Day of month"
                  >
                    {dayOfMonthOrdinal(draftFilterDayOfMonth)}
                    <span className={"expenses-date-filter-submenu-trigger-chevron" + (openSubPicker === "dayOfMonth" ? " is-open" : "")} aria-hidden>
                      <IconChevronDown />
                    </span>
                  </button>
                  {openSubPicker === "dayOfMonth" && (
                    <ul
                      ref={dayOfMonthListRef}
                      className="expenses-category-dropdown-list expenses-date-filter-submenu-list"
                      role="listbox"
                      aria-label="Day of month"
                      id="expenses-date-filter-day-of-month-listbox"
                    >
                      {DAYS_OF_MONTH.map((day) => (
                        <li
                          key={day}
                          role="option"
                          aria-selected={draftFilterDayOfMonth === day}
                          className={
                            "expenses-category-dropdown-option" +
                            (draftFilterDayOfMonth === day ? " is-selected" : "")
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setDraftFilterDayOfMonth(day);
                            onFilterDayOfMonthChange(day);
                            setOpenSubPicker(null);
                          }}
                        >
                          <span className="expenses-category-dropdown-option-text">{dayOfMonthOrdinal(day)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
            {draftMode === "month" && (
              <div className="expenses-date-filter-submenu-content expenses-date-filter-submenu-content-row" role="group" aria-label="Select month and year">
                <div className="expenses-date-filter-submenu-picker">
                  <button
                    type="button"
                    className="expenses-date-filter-submenu-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenSubPicker((v) => (v === "month" ? null : "month"));
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={openSubPicker === "month"}
                    aria-label="Month"
                  >
                    {MONTH_NAMES[draftFilterMonth - 1]}
                    <span className={"expenses-date-filter-submenu-trigger-chevron" + (openSubPicker === "month" ? " is-open" : "")} aria-hidden>
                      <IconChevronDown />
                    </span>
                  </button>
                  {openSubPicker === "month" && (
                    <ul
                      ref={monthListRef}
                      className="expenses-category-dropdown-list expenses-date-filter-submenu-list"
                      role="listbox"
                      aria-label="Month"
                      id="expenses-date-filter-month-listbox"
                    >
                      {MONTH_NAMES.map((name, i) => (
                        <li
                          key={name}
                          role="option"
                          aria-selected={draftFilterMonth === i + 1}
                          className={
                            "expenses-category-dropdown-option" +
                            (draftFilterMonth === i + 1 ? " is-selected" : "")
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setDraftFilterMonth(i + 1);
                            onFilterMonthChange(i + 1);
                            setOpenSubPicker(null);
                          }}
                        >
                          <span className="expenses-category-dropdown-option-text">{name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="expenses-date-filter-submenu-picker">
                  <button
                    type="button"
                    className="expenses-date-filter-submenu-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenSubPicker((v) => (v === "year" ? null : "year"));
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={openSubPicker === "year"}
                    aria-label="Year"
                  >
                    {draftFilterYear}
                    <span className={"expenses-date-filter-submenu-trigger-chevron" + (openSubPicker === "year" ? " is-open" : "")} aria-hidden>
                      <IconChevronDown />
                    </span>
                  </button>
                  {openSubPicker === "year" && (
                    <ul
                      ref={yearListRef}
                      className="expenses-category-dropdown-list expenses-date-filter-submenu-list"
                      role="listbox"
                      aria-label="Year"
                      id="expenses-date-filter-year-listbox"
                    >
                      {YEARS.map((y) => (
                        <li
                          key={y}
                          role="option"
                          aria-selected={draftFilterYear === y}
                          className={
                            "expenses-category-dropdown-option" +
                            (draftFilterYear === y ? " is-selected" : "")
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setDraftFilterYear(y);
                            onFilterYearChange(y);
                            setOpenSubPicker(null);
                          }}
                        >
                          <span className="expenses-category-dropdown-option-text">{y}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
            {draftMode === "year" && (
              <div className="expenses-date-filter-submenu-content" role="group" aria-label="Select year">
                <div className="expenses-date-filter-submenu-picker">
                  <button
                    type="button"
                    className="expenses-date-filter-submenu-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenSubPicker((v) => (v === "year" ? null : "year"));
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={openSubPicker === "year"}
                    aria-label="Year"
                  >
                    {draftFilterYear}
                    <span className={"expenses-date-filter-submenu-trigger-chevron" + (openSubPicker === "year" ? " is-open" : "")} aria-hidden>
                      <IconChevronDown />
                    </span>
                  </button>
                  {openSubPicker === "year" && (
                    <ul
                      ref={yearListRef}
                      className="expenses-category-dropdown-list expenses-date-filter-submenu-list"
                      role="listbox"
                      aria-label="Year"
                      id="expenses-date-filter-year-listbox"
                    >
                      {YEARS.map((y) => (
                        <li
                          key={y}
                          role="option"
                          aria-selected={draftFilterYear === y}
                          className={
                            "expenses-category-dropdown-option" +
                            (draftFilterYear === y ? " is-selected" : "")
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setDraftFilterYear(y);
                            onFilterYearChange(y);
                            setOpenSubPicker(null);
                          }}
                        >
                          <span className="expenses-category-dropdown-option-text">{y}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
            {draftMode === "range" && (
              <div className="expenses-date-filter-submenu-content expenses-date-filter-submenu-content-row" role="group" aria-label="Select date range">
                <div className="calendar-picker-anchor expenses-date-filter-submenu-picker">
                  <button
                    type="button"
                    className="expenses-date-filter-submenu-trigger"
                    onClick={(e) => {
                    e.stopPropagation();
                    setOpenCalendar((v) => (v === "rangeStart" ? null : "rangeStart"));
                  }}
                    aria-haspopup="dialog"
                    aria-expanded={openCalendar === "rangeStart"}
                    aria-label="From date"
                  >
                    {formatDayLabel(draftRangeStart) === "Select date" ? "Start" : formatDayLabel(draftRangeStart)}
                    <span className={"expenses-date-filter-submenu-trigger-chevron" + (openCalendar === "rangeStart" ? " is-open" : "")} aria-hidden>
                      <IconChevronDown />
                    </span>
                  </button>
                  {openCalendar === "rangeStart" && (
                    <CalendarPickerPopup
                      value={draftRangeStart}
                      onChange={(dateStr) => {
                        setDraftRangeStart(dateStr);
                        setOpenCalendar(null);
                      }}
                      onClose={() => setOpenCalendar(null)}
                      showToday
                      ariaLabel="From date"
                    />
                  )}
                </div>
                <span className="expenses-date-filter-submenu-sep" aria-hidden="true">–</span>
                <div className="calendar-picker-anchor expenses-date-filter-submenu-picker">
                  <button
                    type="button"
                    className="expenses-date-filter-submenu-trigger"
                    onClick={(e) => {
                    e.stopPropagation();
                    setOpenCalendar((v) => (v === "rangeEnd" ? null : "rangeEnd"));
                  }}
                    aria-haspopup="dialog"
                    aria-expanded={openCalendar === "rangeEnd"}
                    aria-label="To date"
                  >
                    {formatDayLabel(draftRangeEnd) === "Select date" ? "End" : formatDayLabel(draftRangeEnd)}
                    <span className={"expenses-date-filter-submenu-trigger-chevron" + (openCalendar === "rangeEnd" ? " is-open" : "")} aria-hidden>
                      <IconChevronDown />
                    </span>
                  </button>
                  {openCalendar === "rangeEnd" && (
                    <CalendarPickerPopup
                      value={draftRangeEnd}
                      onChange={(dateStr) => {
                        setDraftRangeEnd(dateStr);
                        setOpenCalendar(null);
                      }}
                      onClose={() => setOpenCalendar(null)}
                      showToday
                      ariaLabel="To date"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
