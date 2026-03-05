import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "../components/AppLayout";
import { Button } from "../components/Button";
import { CloseButton } from "../components/CloseButton";
import { ConfirmModal } from "../components/ConfirmModal";
import { UiCheckbox } from "../components/UiCheckbox";
import { SectionLoadingSpinner } from "../components/SectionLoadingSpinner";
import { UiDatePickerField } from "../components/UiDatePickerField";
import { UiDateTimePickerField } from "../components/UiDateTimePickerField";
import { UiInput } from "../components/UiInput";
import { UiMenuDropdown } from "../components/UiMenuDropdown";
import { useProjectLayout } from "../lib/useProjectLayout";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchCalendarGoogleStatus,
  fetchGoogleCalendars,
  isAuthenticated,
  setGoogleCalendarSelection,
  startGoogleCalendarConnect,
  syncGoogleCalendar,
  disconnectGoogleCalendar,
  updateCalendarEvent,
  type CalendarEvent,
  type CalendarGoogleCalendar,
  type CalendarGoogleStatus,
} from "../lib/api";
import { useTheme } from "./_app";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CALENDAR_OAUTH_MESSAGE_TYPE = "ideahome:calendar-oauth-complete";
const SYNC_REQUEST_TIMEOUT_MS = 60_000;

function toYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYMD(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function monthRange(viewDate: Date): { start: string; end: string } {
  const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1, 0, 0, 0);
  const end = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0,
    23,
    59,
    59
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

function buildMonthGrid(viewDate: Date): Date[] {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const offset = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) return "All day";
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  return `${start.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function formatEventDate(event: CalendarEvent): string {
  const start = new Date(event.startAt);
  return start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isHolidayEvent(event: CalendarEvent): boolean {
  const providerEventId = event.providerEventId.toLowerCase();
  if (providerEventId.includes("holiday")) return true;
  const title = event.title.toLowerCase();
  if (title.includes("holiday")) return true;
  const description = event.description?.toLowerCase() ?? "";
  return description.includes("public holiday");
}

function toLocalDateTimeInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function ceilToNextHalfHour(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  const remainder = minutes % 30;
  const delta = remainder === 0 ? 0 : 30 - remainder;
  rounded.setMinutes(minutes + delta);
  return rounded;
}

function ensureEndAfterStart(startRaw: string, endRaw: string): string {
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime())) return endRaw;
  if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    const next = new Date(start);
    next.setHours(next.getHours() + 1);
    return toLocalDateTimeInputValue(next);
  }
  return endRaw;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

export default function CalendarPage() {
  const router = useRouter();
  const layout = useProjectLayout();
  const {
    projects,
    projectsLoaded,
    selectedProjectId,
    setSelectedProjectId,
    projectDisplayName,
    drawerOpen,
    setDrawerOpen,
    editingProjectId,
    setEditingProjectId,
    editingProjectName,
    setEditingProjectName,
    projectNameInputRef,
    saveProjectName,
    cancelEditProjectName,
    projectToDelete,
    setProjectToDelete,
    projectDeleting,
    handleDeleteProject,
  } = layout;
  const { theme, toggleTheme } = useTheme();

  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(toYMD(today));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<CalendarGoogleStatus | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<CalendarGoogleCalendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
  const [linkedCalendarDropdownOpen, setLinkedCalendarDropdownOpen] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [attemptedEventSave, setAttemptedEventSave] = useState(false);

  const titleRequiredError = attemptedEventSave && title.trim().length === 0;
  const startRequiredError =
    attemptedEventSave && Number.isNaN(new Date(startAt).getTime());
  const endRequiredError = attemptedEventSave && Number.isNaN(new Date(endAt).getTime());

  const monthGrid = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const day = toYMD(new Date(event.startAt));
      const existing = map.get(day);
      if (existing) existing.push(event);
      else map.set(day, [event]);
    }
    return map;
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    return [...(eventsByDate.get(selectedDate) ?? [])].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
  }, [eventsByDate, selectedDate]);

  const editingEvent = useMemo(
    () => (editingEventId ? events.find((event) => event.id === editingEventId) ?? null : null),
    [editingEventId, events]
  );
  const hasEditingEventChanges = useMemo(() => {
    if (!editingEventId || !editingEvent) return false;
    return (
      title.trim() !== editingEvent.title.trim() ||
      description !== (editingEvent.description ?? "") ||
      location !== (editingEvent.location ?? "") ||
      startAt !== toLocalDateTimeInputValue(new Date(editingEvent.startAt)) ||
      endAt !== toLocalDateTimeInputValue(new Date(editingEvent.endAt)) ||
      isAllDay !== editingEvent.isAllDay
    );
  }, [description, editingEvent, editingEventId, endAt, isAllDay, location, startAt, title]);

  const resetForm = useCallback(() => {
    setEditingEventId(null);
    setAttemptedEventSave(false);
    setTitle("");
    setDescription("");
    setLocation("");
    const roundedNow = ceilToNextHalfHour(new Date());
    const start = new Date(`${selectedDate}T00:00:00`);
    start.setHours(roundedNow.getHours(), roundedNow.getMinutes(), 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    setStartAt(toLocalDateTimeInputValue(start));
    setEndAt(toLocalDateTimeInputValue(end));
    setIsAllDay(false);
  }, [selectedDate]);

  const loadCalendarData = useCallback(async () => {
    if (!selectedProjectId || !isAuthenticated()) {
      setStatus(null);
      setGoogleCalendars([]);
      setEvents([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [{ start, end }, googleStatus] = [monthRange(viewDate), await fetchCalendarGoogleStatus(selectedProjectId)];
      setStatus(googleStatus);
      const [items, calendars] = await Promise.all([
        fetchCalendarEvents(selectedProjectId, start, end),
        googleStatus.connected
          ? fetchGoogleCalendars(selectedProjectId)
          : Promise.resolve([]),
      ]);
      setEvents(items);
      setGoogleCalendars(calendars);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, viewDate]);

  useEffect(() => {
    void loadCalendarData();
  }, [loadCalendarData]);

  useEffect(() => {
    if (!router.isReady) return;
    const connected = router.query.google_connected === "1";
    const oauthError =
      typeof router.query.google_error === "string" ? router.query.google_error : "";
    const projectId =
      typeof router.query.projectId === "string" ? router.query.projectId : "";

    if (!connected && !oauthError) return;

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: CALENDAR_OAUTH_MESSAGE_TYPE,
          googleConnected: connected,
          googleError: oauthError || null,
          projectId: projectId || null,
        },
        window.location.origin
      );
      window.close();
      return;
    }

    if (connected) {
      setSuccessMessage("Google Calendar connected. You can sync from this page.");
      setError("");
      void loadCalendarData();
    } else if (oauthError) {
      setError("Google Calendar connection failed. Try connecting again.");
      setSuccessMessage("");
    }

    const nextQuery = { ...router.query };
    delete nextQuery.google_connected;
    delete nextQuery.google_error;
    void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true,
    });
  }, [loadCalendarData, router]);

  useEffect(() => {
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (!successMessage) return;
    const timeoutId = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3_000);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  const handleConnectGoogle = useCallback(async () => {
    if (!selectedProjectId) return;
    setError("");
    setSuccessMessage("");
    try {
      const { url } = await startGoogleCalendarConnect(selectedProjectId);
      let complete = false;
      let timeoutId = 0;
      const cleanup = () => {
        if (timeoutId) window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
      };
      const finish = (message?: string, errorMessage?: string) => {
        if (complete) return;
        complete = true;
        cleanup();
        if (typeof message === "string") setSuccessMessage(message);
        if (typeof errorMessage === "string") setError(errorMessage);
        void loadCalendarData();
      };
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const data = event.data as
          | {
              type?: string;
              googleConnected?: boolean;
              googleError?: string | null;
              projectId?: string | null;
            }
          | undefined;
        if (!data || data.type !== CALENDAR_OAUTH_MESSAGE_TYPE) return;
        if (data.projectId && data.projectId !== selectedProjectId) return;
        if (data.googleConnected) {
          finish("Google Calendar connected. You can sync from this page.");
          return;
        }
        finish("", "Google Calendar connection failed. Try connecting again.");
      };
      window.addEventListener("message", onMessage);
      const popupWidth = 520;
      const popupHeight = 700;
      const screenLeft = typeof window.screenLeft === "number" ? window.screenLeft : window.screenX;
      const screenTop = typeof window.screenTop === "number" ? window.screenTop : window.screenY;
      const viewportWidth =
        window.innerWidth ||
        document.documentElement.clientWidth ||
        window.screen.width;
      const viewportHeight =
        window.innerHeight ||
        document.documentElement.clientHeight ||
        window.screen.height;
      const left = Math.max(0, Math.round(screenLeft + (viewportWidth - popupWidth) / 2));
      const top = Math.max(0, Math.round(screenTop + (viewportHeight - popupHeight) / 2));
      const popup = window.open(
        url,
        "google-calendar-connect",
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top}`
      );
      if (!popup) {
        cleanup();
        setError("Popup blocked. Allow popups to connect Google Calendar.");
        return;
      }
      timeoutId = window.setTimeout(() => {
        finish("", "Google Calendar connection timed out. Try again.");
      }, 5 * 60 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start connection");
    }
  }, [loadCalendarData, selectedProjectId]);

  const handleSync = useCallback(async () => {
    if (!selectedProjectId) return;
    setError("");
    setSuccessMessage("");
    setSyncing(true);
    try {
      const result = await withTimeout(
        syncGoogleCalendar(selectedProjectId),
        SYNC_REQUEST_TIMEOUT_MS,
        "Calendar sync timed out. Please try again."
      );
      setSuccessMessage(
        `Synced ${result.upserted} event(s)${result.deleted > 0 ? `, removed ${result.deleted}` : ""}.`
      );
      void loadCalendarData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calendar sync failed");
    } finally {
      setSyncing(false);
    }
  }, [loadCalendarData, selectedProjectId]);

  const handleDisconnectGoogle = useCallback(async () => {
    if (!selectedProjectId) return;
    setError("");
    setSuccessMessage("");
    setDisconnecting(true);
    try {
      await disconnectGoogleCalendar(selectedProjectId);
      setSuccessMessage("Google Calendar disconnected for this project.");
      setDisconnectConfirmOpen(false);
      await loadCalendarData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }, [loadCalendarData, selectedProjectId]);

  const handleSaveEvent = useCallback(async () => {
    setAttemptedEventSave(true);
    if (!selectedProjectId) {
      setError("Select a project before creating an event.");
      setSuccessMessage("");
      return;
    }
    if (!status?.connected) {
      setError("Connect Google Calendar before creating an event.");
      setSuccessMessage("");
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }
    const parsedStartAt = new Date(startAt);
    const normalizedEndAt = ensureEndAfterStart(startAt, endAt);
    if (normalizedEndAt !== endAt) {
      setEndAt(normalizedEndAt);
    }
    const parsedEndAt = new Date(normalizedEndAt);
    if (Number.isNaN(parsedStartAt.getTime()) || Number.isNaN(parsedEndAt.getTime())) {
      return;
    }
    setError("");
    setSuccessMessage("");
    try {
      const payload = {
        title: trimmedTitle,
        description: description.trim() || null,
        location: location.trim() || null,
        startAt: parsedStartAt.toISOString(),
        endAt: parsedEndAt.toISOString(),
        isAllDay,
      };
      if (editingEventId) {
        await updateCalendarEvent(selectedProjectId, editingEventId, payload);
        setSuccessMessage("Event updated.");
      } else {
        await createCalendarEvent(selectedProjectId, payload);
        setSuccessMessage("Event created.");
      }
      await loadCalendarData();
      resetForm();
      setAttemptedEventSave(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    }
  }, [
    description,
    editingEventId,
    endAt,
    isAllDay,
    loadCalendarData,
    location,
    resetForm,
    selectedProjectId,
    startAt,
    status?.connected,
    title,
  ]);

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      if (!selectedProjectId || !status?.connected) return;
      setError("");
      setSuccessMessage("");
      try {
        await deleteCalendarEvent(selectedProjectId, eventId);
        setSuccessMessage("Event deleted.");
        await loadCalendarData();
        if (editingEventId === eventId) resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete event");
      }
    },
    [editingEventId, loadCalendarData, resetForm, selectedProjectId, status?.connected]
  );

  const startEditing = useCallback((event: CalendarEvent) => {
    setEditingEventId(event.id);
    setAttemptedEventSave(false);
    setTitle(event.title);
    setDescription(event.description ?? "");
    setLocation(event.location ?? "");
    setStartAt(toLocalDateTimeInputValue(new Date(event.startAt)));
    setEndAt(toLocalDateTimeInputValue(new Date(event.endAt)));
    setIsAllDay(event.isAllDay);
  }, []);

  return (
    <AppLayout
      title="Calendar · Idea Home"
      activeTab="calendar"
      projectName={projectDisplayName}
      projectId={selectedProjectId || undefined}
      searchPlaceholder="Search project"
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      projects={projects}
      selectedProjectId={selectedProjectId ?? ""}
      setSelectedProjectId={setSelectedProjectId}
      editingProjectId={editingProjectId}
      setEditingProjectId={setEditingProjectId}
      editingProjectName={editingProjectName}
      setEditingProjectName={setEditingProjectName}
      saveProjectName={saveProjectName}
      cancelEditProjectName={cancelEditProjectName}
      projectNameInputRef={projectNameInputRef}
      theme={theme}
      toggleTheme={toggleTheme}
      projectToDelete={projectToDelete}
      setProjectToDelete={setProjectToDelete}
      projectDeleting={projectDeleting}
      handleDeleteProject={handleDeleteProject}
      onCreateProject={layout.createProjectByName}
      onRenameProject={layout.renameProjectById}
    >
      {!projectsLoaded ? (
        <div className="tests-page-single-loading">
          <SectionLoadingSpinner />
        </div>
      ) : (
        <div className="tests-page-content calendar-page-content">
          <h1 className="tests-page-title">Calendar</h1>
          {error && (
            <div className="calendar-alert-stack">
              <section className="tests-page-section expenses-error-notice" role="alert">
                <p className="expenses-error-notice-text">{error}</p>
              </section>
            </div>
          )}

          {!selectedProjectId ? (
            <section className="tests-page-section">
              <p className="tests-page-empty">Select a project to use calendar sync.</p>
            </section>
          ) : (
            <>
              <section className="tests-page-section calendar-sync-card">
                <div className="calendar-sync-row">
                  <div>
                    <h2 className="tests-page-section-title">Google Calendar</h2>
                    <p className="calendar-sync-subtitle">
                      {status?.connected
                        ? "Connected. Choose a calendar and sync events."
                        : "Connect Google Calendar to sync events for this project."}
                    </p>
                  </div>
                  <div className="calendar-sync-actions">
                    <div className="calendar-sync-primary">
                      {status?.connected && status.lastSyncedAt && (
                        <span className="calendar-last-sync" role="status">
                          Last synced {new Date(status.lastSyncedAt).toLocaleString()}
                        </span>
                      )}
                      <Button
                        variant="secondary"
                        size="md"
                        className="calendar-sync-btn"
                        onClick={handleSync}
                        disabled={!status?.connected || syncing}
                      >
                        {syncing ? "Syncing..." : "Sync now"}
                      </Button>
                    </div>
                    <Button
                      variant="secondary"
                      size="md"
                      className="calendar-connect-btn"
                      onClick={handleConnectGoogle}
                    >
                      {status?.connected ? "Reconnect Google" : "Connect Google Calendar"}
                    </Button>
                    {status?.connected && (
                      <Button
                        variant="danger"
                        size="md"
                        className="calendar-disconnect-btn"
                        onClick={() => setDisconnectConfirmOpen(true)}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                </div>
                {status?.connected && (
                  <div className="calendar-sync-row calendar-sync-row-secondary">
                    <label className="calendar-sync-label">
                      Linked calendar
                    </label>
                    <UiMenuDropdown
                      className="calendar-linked-calendar-dropdown"
                      open={linkedCalendarDropdownOpen}
                      onOpenChange={setLinkedCalendarDropdownOpen}
                      triggerAriaLabel="Select linked calendar"
                      triggerText={
                        (googleCalendars.length > 0
                          ? googleCalendars
                          : [{ id: "primary", summary: "Primary", primary: true }]
                        ).find((calendar) => calendar.id === (status.selectedCalendarId ?? ""))
                          ?.summary ??
                        (status.selectedCalendarId || "Select calendar")
                      }
                      groups={[
                        {
                          id: "linked-calendars",
                          items: (googleCalendars.length > 0
                            ? googleCalendars
                            : [{ id: "primary", summary: "Primary", primary: true }]
                          ).map((calendar) => ({
                            id: calendar.id,
                            label: calendar.summary,
                            selected: calendar.id === status.selectedCalendarId,
                            onSelect: () => {
                              if (!selectedProjectId) return;
                              void (async () => {
                                try {
                                  await setGoogleCalendarSelection(
                                    selectedProjectId,
                                    calendar.id
                                  );
                                  await loadCalendarData();
                                } catch (err) {
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to update selected calendar"
                                  );
                                }
                              })();
                            },
                          })),
                        },
                      ]}
                    />
                  </div>
                )}
              </section>

              {successMessage && (
                <div className="calendar-success-toast-slot">
                  <div className="calendar-success-toast" role="status">
                    <p className="calendar-success-notice">{successMessage}</p>
                    <CloseButton
                      className="calendar-success-close"
                      size="sm"
                      aria-label="Dismiss success message"
                      onClick={() => setSuccessMessage("")}
                    />
                  </div>
                </div>
              )}

              <section className="tests-page-section calendar-main-grid">
                <div className="calendar-month-panel">
                  <div className="calendar-month-toolbar">
                    <div className="calendar-month-nav">
                      <button
                        type="button"
                        className="calendar-picker-nav-btn"
                        aria-label="Previous month"
                        onClick={() =>
                          setViewDate(
                            (current) =>
                              new Date(current.getFullYear(), current.getMonth() - 1, 1)
                          )
                        }
                      >
                        ‹
                      </button>
                      <div className="calendar-month-title">
                        {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                      </div>
                      <button
                        type="button"
                        className="calendar-picker-nav-btn"
                        aria-label="Next month"
                        onClick={() =>
                          setViewDate(
                            (current) =>
                              new Date(current.getFullYear(), current.getMonth() + 1, 1)
                          )
                        }
                      >
                        ›
                      </button>
                    </div>

                    <UiDatePickerField
                      className="calendar-date-filter"
                      popupClassName="calendar-picker-popup-design-system"
                      label="Selected day"
                      value={selectedDate}
                      ariaLabel="Calendar day picker"
                      onChange={(value) => {
                        setSelectedDate(value);
                        const selected = parseYMD(value);
                        if (selected) {
                          setViewDate(
                            new Date(selected.getFullYear(), selected.getMonth(), 1)
                          );
                        }
                      }}
                    />
                  </div>

                  <div className="calendar-month-weekdays">
                    {DAY_NAMES.map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>

                  <div className="calendar-month-grid">
                    {monthGrid.map((date) => {
                      const key = toYMD(date);
                      const dayEvents = eventsByDate.get(key) ?? [];
                      const isCurrentMonth = date.getMonth() === viewDate.getMonth();
                      const isSelected = key === selectedDate;
                      const isToday = key === toYMD(today);
                      return (
                        <button
                          key={key}
                          type="button"
                          className={
                            "calendar-month-cell" +
                            (isCurrentMonth ? "" : " is-outside") +
                            (isSelected ? " is-selected" : "") +
                            (isToday ? " is-today" : "")
                          }
                          onClick={() => setSelectedDate(key)}
                        >
                          <span className="calendar-month-cell-day">{date.getDate()}</span>
                          <div className="calendar-month-cell-events">
                            {dayEvents.slice(0, 2).map((event) => (
                              <span
                                key={event.id}
                                className={
                                  "calendar-month-chip" +
                                  (isHolidayEvent(event) ? " calendar-month-chip-holiday" : "")
                                }
                              >
                                {event.title}
                              </span>
                            ))}
                            {dayEvents.length > 2 && (
                              <span className="calendar-month-chip calendar-month-chip-muted">
                                +{dayEvents.length - 2} more
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="calendar-side-panel">
                  <h3 className="calendar-side-title">
                    {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </h3>
                  <ul className="calendar-events-list">
                    {selectedDayEvents.length === 0 ? (
                      <li className="calendar-events-empty">No events for this day.</li>
                    ) : (
                      selectedDayEvents.map((event) => (
                        <li
                          key={event.id}
                          className={
                            "calendar-event-item" +
                            (isHolidayEvent(event) ? " calendar-event-item-holiday" : "")
                          }
                        >
                          <div className="calendar-event-item-main">
                            <strong>{event.title}</strong>
                            <span>{formatEventTime(event)}</span>
                            <span>{formatEventDate(event)}</span>
                          </div>
                          <div className="calendar-event-item-actions">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(event)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => void handleDeleteEvent(event.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>

                  <div className="calendar-event-editor">
                    <h4>{editingEventId ? "Edit event" : "Create event"}</h4>
                    <div
                      className={
                        "calendar-event-editor-field" + (titleRequiredError ? " is-error" : "")
                      }
                    >
                      <label>Title</label>
                      <UiInput
                        id="calendar-event-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Team sync"
                        className={titleRequiredError ? "is-error" : undefined}
                        aria-invalid={titleRequiredError || undefined}
                      />
                    </div>
                    <div className="calendar-event-editor-field">
                      <label>Description</label>
                      <UiInput
                        id="calendar-event-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Optional details"
                      />
                    </div>
                    <div className="calendar-event-editor-field">
                      <label>Location</label>
                      <UiInput
                        id="calendar-event-location"
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder="Optional location"
                      />
                    </div>
                    <div className="calendar-event-editor-row">
                      <div
                        className={
                          "calendar-event-editor-field" + (startRequiredError ? " is-error" : "")
                        }
                      >
                        <label>Start</label>
                        <UiDateTimePickerField
                          label="Start"
                          value={startAt}
                          onChange={(value) => {
                            setStartAt(value);
                            setEndAt((current) => ensureEndAfterStart(value, current));
                          }}
                          ariaLabel="Event start date and time"
                          className="calendar-event-datetime-field"
                          showInlineLabel={false}
                          hasError={startRequiredError}
                        />
                      </div>
                      <div
                        className={
                          "calendar-event-editor-field" + (endRequiredError ? " is-error" : "")
                        }
                      >
                        <label>End</label>
                        <UiDateTimePickerField
                          label="End"
                          value={endAt}
                          onChange={(value) => setEndAt(ensureEndAfterStart(startAt, value))}
                          ariaLabel="Event end date and time"
                          className="calendar-event-datetime-field"
                          showInlineLabel={false}
                          hasError={endRequiredError}
                        />
                      </div>
                    </div>
                    <div className="calendar-event-editor-checkbox">
                      <UiCheckbox
                        checked={isAllDay}
                        onChange={(event) => setIsAllDay(event.target.checked)}
                      />
                      <span>All day</span>
                    </div>
                    <div className="calendar-event-editor-actions">
                      {!editingEventId || hasEditingEventChanges ? (
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => void handleSaveEvent()}
                        >
                          {editingEventId ? "Save changes" : "Create event"}
                        </Button>
                      ) : null}
                      {editingEventId && (
                        <Button variant="ghost" size="md" onClick={resetForm}>
                          Cancel edit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {(loading || syncing) && (
                <div className="tests-page-single-loading">
                  <SectionLoadingSpinner />
                </div>
              )}
              {disconnectConfirmOpen && (
                <ConfirmModal
                  title="Disconnect Google Calendar?"
                  message="This disconnects Google Calendar for this project only and removes its synced events from this project view."
                  confirmLabel="Disconnect"
                  confirmBusyLabel="Disconnecting..."
                  busy={disconnecting}
                  onClose={() => setDisconnectConfirmOpen(false)}
                  onConfirm={() => void handleDisconnectGoogle()}
                  danger
                />
              )}
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}
