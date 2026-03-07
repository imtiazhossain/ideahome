import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppLayout } from "../components/AppLayout";
import { SectionLoadingSpinner } from "../components/SectionLoadingSpinner";
import { useProjectLayout } from "../lib/useProjectLayout";
import { useTheme } from "./_app";

/* ─── colour presets (shared with calendar) ─── */
const COLOR_PRESETS = [
  { id: "purple", dot: "#a78bfa", bg: "rgba(167,139,250,0.18)", border: "rgba(167,139,250,0.42)" },
  { id: "teal", dot: "#22d3ee", bg: "rgba(34,211,238,0.18)", border: "rgba(8,145,178,0.46)" },
  { id: "green", dot: "#86efac", bg: "rgba(134,239,172,0.18)", border: "rgba(22,163,74,0.46)" },
  { id: "amber", dot: "#fbbf24", bg: "rgba(251,191,36,0.18)", border: "rgba(245,158,11,0.4)" },
  { id: "rose", dot: "#fb7185", bg: "rgba(251,113,133,0.18)", border: "rgba(244,63,94,0.4)" },
  { id: "violet", dot: "#c084fc", bg: "rgba(192,132,252,0.18)", border: "rgba(139,92,246,0.4)" },
] as const;

type ColorPresetId = (typeof COLOR_PRESETS)[number]["id"];

/* ─── data model ─── */
interface TimelinePhase {
  id: string;
  name: string;
  color: ColorPresetId;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  progress: number;  // 0-100
}

type ZoomLevel = "month" | "quarter" | "year";

/* ─── storage helpers ─── */
function getStorageKey(projectId: string): string {
  return `ideahome-timeline-phases-${projectId}`;
}

function loadPhases(projectId: string): TimelinePhase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: unknown): p is TimelinePhase =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as TimelinePhase).id === "string" &&
        typeof (p as TimelinePhase).name === "string" &&
        typeof (p as TimelinePhase).startDate === "string" &&
        typeof (p as TimelinePhase).endDate === "string"
    );
  } catch {
    return [];
  }
}

function savePhases(projectId: string, phases: TimelinePhase[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(phases));
  } catch { /* ignore */ }
}

/* ─── date helpers ─── */
function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseYMD(s: string): Date {
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatShortMonth(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short" });
}

function uid(): string {
  return `ph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ─── generate grid columns ─── */
interface GridColumn {
  label: string;
  startDate: Date;
  endDate: Date;
  days: number;
}

function buildGridColumns(viewStart: Date, zoom: ZoomLevel): GridColumn[] {
  const columns: GridColumn[] = [];
  let count: number;
  switch (zoom) {
    case "month":
      count = 6;
      break;
    case "quarter":
      count = 12;
      break;
    case "year":
      count = 24;
      break;
  }
  for (let i = 0; i < count; i++) {
    const colStart = addMonths(viewStart, i);
    const colEnd = addMonths(viewStart, i + 1);
    columns.push({
      label: zoom === "year" ? formatShortMonth(colStart) : formatMonthLabel(colStart),
      startDate: colStart,
      endDate: colEnd,
      days: diffDays(colStart, colEnd),
    });
  }
  return columns;
}

/* ─── component ─── */
export default function TimelinePage() {
  const layout = useProjectLayout();
  const { theme, toggleTheme } = useTheme();
  const selectedProjectId = layout.selectedProjectId;

  const [phases, setPhases] = useState<TimelinePhase[]>([]);
  const [zoom, setZoom] = useState<ZoomLevel>("month");
  const [viewStart, setViewStart] = useState(() => startOfMonth(new Date()));
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [addingPhase, setAddingPhase] = useState(false);

  // draft state for add/edit
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState<ColorPresetId>("purple");
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [draftProgress, setDraftProgress] = useState(0);

  // drag state
  const [dragInfo, setDragInfo] = useState<{
    phaseId: string;
    edge: "start" | "end";
    initialX: number;
    initialDate: string;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // load phases when project changes
  useEffect(() => {
    if (selectedProjectId) {
      setPhases(loadPhases(selectedProjectId));
    } else {
      setPhases([]);
    }
    setEditingPhaseId(null);
    setAddingPhase(false);
  }, [selectedProjectId]);

  // persist phases
  const persistPhases = useCallback(
    (next: TimelinePhase[]) => {
      setPhases(next);
      if (selectedProjectId) savePhases(selectedProjectId, next);
    },
    [selectedProjectId]
  );

  // grid columns
  const columns = useMemo(() => buildGridColumns(viewStart, zoom), [viewStart, zoom]);
  const gridStartDate = columns[0]?.startDate ?? new Date();
  const gridEndDate = columns[columns.length - 1]?.endDate ?? new Date();
  const totalGridDays = diffDays(gridStartDate, gridEndDate);

  // today marker position
  const today = useMemo(() => new Date(), []);
  const todayPct = useMemo(() => {
    const d = diffDays(gridStartDate, today);
    if (d < 0 || d > totalGridDays) return null;
    return (d / totalGridDays) * 100;
  }, [gridStartDate, today, totalGridDays]);

  // bar position helpers
  const getBarStyle = useCallback(
    (phase: TimelinePhase) => {
      const s = parseYMD(phase.startDate);
      const e = parseYMD(phase.endDate);
      const leftDays = diffDays(gridStartDate, s);
      const widthDays = diffDays(s, e);
      const leftPct = Math.max(0, (leftDays / totalGridDays) * 100);
      const widthPct = Math.max(1, Math.min((widthDays / totalGridDays) * 100, 100 - leftPct));
      return { left: `${leftPct}%`, width: `${widthPct}%` };
    },
    [gridStartDate, totalGridDays]
  );

  // navigation
  const navigateView = useCallback(
    (direction: -1 | 1) => {
      const step = zoom === "month" ? 1 : zoom === "quarter" ? 3 : 6;
      setViewStart((prev) => addMonths(prev, direction * step));
    },
    [zoom]
  );

  // edit helpers
  const startEdit = useCallback((phase: TimelinePhase) => {
    setEditingPhaseId(phase.id);
    setAddingPhase(false);
    setDraftName(phase.name);
    setDraftColor(phase.color);
    setDraftStartDate(phase.startDate);
    setDraftEndDate(phase.endDate);
    setDraftProgress(phase.progress);
  }, []);

  const startAdd = useCallback(() => {
    setAddingPhase(true);
    setEditingPhaseId(null);
    setDraftName("");
    setDraftColor(COLOR_PRESETS[phases.length % COLOR_PRESETS.length].id);
    const s = new Date();
    const e = new Date();
    e.setDate(e.getDate() + 30);
    setDraftStartDate(toYMD(s));
    setDraftEndDate(toYMD(e));
    setDraftProgress(0);
  }, [phases.length]);

  const cancelEdit = useCallback(() => {
    setEditingPhaseId(null);
    setAddingPhase(false);
  }, []);

  const saveEdit = useCallback(() => {
    const trimmed = draftName.trim();
    if (!trimmed || !draftStartDate || !draftEndDate) return;
    const adjustedEnd = draftEndDate < draftStartDate ? draftStartDate : draftEndDate;

    if (addingPhase) {
      const newPhase: TimelinePhase = {
        id: uid(),
        name: trimmed,
        color: draftColor,
        startDate: draftStartDate,
        endDate: adjustedEnd,
        progress: draftProgress,
      };
      persistPhases([...phases, newPhase]);
      setAddingPhase(false);
    } else if (editingPhaseId) {
      persistPhases(
        phases.map((p) =>
          p.id === editingPhaseId
            ? { ...p, name: trimmed, color: draftColor, startDate: draftStartDate, endDate: adjustedEnd, progress: draftProgress }
            : p
        )
      );
      setEditingPhaseId(null);
    }
  }, [addingPhase, draftColor, draftEndDate, draftName, draftProgress, draftStartDate, editingPhaseId, persistPhases, phases]);

  const deletePhase = useCallback(
    (id: string) => {
      persistPhases(phases.filter((p) => p.id !== id));
      if (editingPhaseId === id) setEditingPhaseId(null);
    },
    [editingPhaseId, persistPhases, phases]
  );

  // drag-to-resize
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, phaseId: string, edge: "start" | "end") => {
      e.preventDefault();
      e.stopPropagation();
      const phase = phases.find((p) => p.id === phaseId);
      if (!phase) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragInfo({
        phaseId,
        edge,
        initialX: e.clientX,
        initialDate: edge === "start" ? phase.startDate : phase.endDate,
      });
    },
    [phases]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragInfo || !gridRef.current) return;
      const gridRect = gridRef.current.getBoundingClientRect();
      const gridWidth = gridRect.width;
      const deltaX = e.clientX - dragInfo.initialX;
      const deltaDays = Math.round((deltaX / gridWidth) * totalGridDays);
      const baseDate = parseYMD(dragInfo.initialDate);
      const newDate = new Date(baseDate);
      newDate.setDate(newDate.getDate() + deltaDays);
      const newDateStr = toYMD(newDate);

      setPhases((prev) =>
        prev.map((p) => {
          if (p.id !== dragInfo.phaseId) return p;
          if (dragInfo.edge === "start") {
            return { ...p, startDate: newDateStr <= p.endDate ? newDateStr : p.endDate };
          }
          return { ...p, endDate: newDateStr >= p.startDate ? newDateStr : p.startDate };
        })
      );
    },
    [dragInfo, totalGridDays]
  );

  const handlePointerUp = useCallback(() => {
    if (dragInfo && selectedProjectId) {
      // persist the final dragged state
      setPhases((current) => {
        savePhases(selectedProjectId, current);
        return current;
      });
    }
    setDragInfo(null);
  }, [dragInfo, selectedProjectId]);

  // summary stats
  const stats = useMemo(() => {
    const todayStr = toYMD(new Date());
    const inProgress = phases.filter((p) => p.startDate <= todayStr && p.endDate >= todayStr).length;
    const upcoming = phases.filter((p) => p.startDate > todayStr).length;
    const completed = phases.filter((p) => p.progress >= 100).length;
    return { total: phases.length, inProgress, upcoming, completed };
  }, [phases]);

  // resolve color
  const getColor = useCallback((colorId: ColorPresetId) => {
    return COLOR_PRESETS.find((c) => c.id === colorId) ?? COLOR_PRESETS[0];
  }, []);

  // layout props
  const appLayoutProps = {
    title: "Timeline · Idea Home",
    activeTab: "timeline" as const,
    projectName: layout.projectDisplayName,
    projectId: selectedProjectId || undefined,
    searchPlaceholder: "Search project",
    drawerOpen: layout.drawerOpen,
    setDrawerOpen: layout.setDrawerOpen,
    projects: layout.projects,
    selectedProjectId: selectedProjectId ?? "",
    setSelectedProjectId: layout.setSelectedProjectId,
    editingProjectId: layout.editingProjectId,
    setEditingProjectId: layout.setEditingProjectId,
    editingProjectName: layout.editingProjectName,
    setEditingProjectName: layout.setEditingProjectName,
    saveProjectName: layout.saveProjectName,
    cancelEditProjectName: layout.cancelEditProjectName,
    projectNameInputRef: layout.projectNameInputRef,
    theme,
    toggleTheme,
    projectToDelete: layout.projectToDelete,
    setProjectToDelete: layout.setProjectToDelete,
    projectDeleting: layout.projectDeleting,
    handleDeleteProject: layout.handleDeleteProject,
    onCreateProject: layout.createProjectByName,
    onRenameProject: layout.renameProjectById,
  };

  const isEditing = addingPhase || editingPhaseId !== null;

  return (
    <AppLayout {...appLayoutProps}>
      <div className="timeline-page">
        {/* ── Header ── */}
        <div className="timeline-page-header">
          <p className="timeline-page-eyebrow">Operations</p>
          <h1 className="timeline-page-title">Timeline</h1>
          <p className="timeline-page-subtitle">
            Plan and track the schedule for every part of your project.
          </p>
        </div>

        {!layout.projectsLoaded ? (
          <div className="timeline-page-loading">
            <SectionLoadingSpinner />
          </div>
        ) : !selectedProjectId ? (
          <section className="timeline-empty-state" aria-live="polite">
            <h2>No project selected</h2>
            <p>Select a project to plan your timeline.</p>
          </section>
        ) : (
          <>
            {/* ── Toolbar ── */}
            <div className="timeline-toolbar">
              <div className="timeline-toolbar-nav">
                <button
                  type="button"
                  className="timeline-nav-btn"
                  onClick={() => navigateView(-1)}
                  aria-label="Previous"
                  title="Previous"
                >
                  ←
                </button>
                <span className="timeline-nav-label">{formatMonthLabel(viewStart)}</span>
                <button
                  type="button"
                  className="timeline-nav-btn"
                  onClick={() => navigateView(1)}
                  aria-label="Next"
                  title="Next"
                >
                  →
                </button>
              </div>
              <div className="timeline-toolbar-zoom">
                {(["month", "quarter", "year"] as ZoomLevel[]).map((z) => (
                  <button
                    key={z}
                    type="button"
                    className={`timeline-zoom-btn${zoom === z ? " is-active" : ""}`}
                    onClick={() => setZoom(z)}
                  >
                    {z.charAt(0).toUpperCase() + z.slice(1)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="timeline-add-btn"
                onClick={startAdd}
                disabled={addingPhase}
                aria-label="Add phase"
              >
                + Add Phase
              </button>
            </div>

            {/* ── Gantt Chart ── */}
            <div className="timeline-gantt">
              {/* Column headers */}
              <div className="timeline-gantt-headers">
                <div className="timeline-gantt-label-col timeline-gantt-header-label">Phase</div>
                <div className="timeline-gantt-grid-col timeline-gantt-header-months">
                  {columns.map((col, i) => (
                    <div
                      key={i}
                      className="timeline-gantt-month-header"
                      style={{ width: `${(col.days / totalGridDays) * 100}%` }}
                    >
                      {col.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              {phases.length === 0 && !addingPhase ? (
                <div className="timeline-empty-rows">
                  <p>No phases yet. Click <strong>+ Add Phase</strong> to start planning your project schedule.</p>
                </div>
              ) : (
                <div className="timeline-gantt-body">
                  {phases.map((phase) => {
                    const color = getColor(phase.color);
                    const barStyle = getBarStyle(phase);
                    return (
                      <div key={phase.id} className="timeline-gantt-row">
                        <div className="timeline-gantt-label-col">
                          <button
                            type="button"
                            className={`timeline-phase-label${editingPhaseId === phase.id ? " is-editing" : ""}`}
                            onClick={() => startEdit(phase)}
                            title={`Edit ${phase.name}`}
                          >
                            <span
                              className="timeline-phase-dot"
                              style={{ background: color.dot }}
                            />
                            <span className="timeline-phase-name">{phase.name}</span>
                          </button>
                        </div>
                        <div
                          className="timeline-gantt-grid-col timeline-gantt-grid-cells"
                          ref={gridRef}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onPointerCancel={handlePointerUp}
                        >
                          {/* grid lines */}
                          {columns.map((col, i) => (
                            <div
                              key={i}
                              className="timeline-gantt-cell"
                              style={{ width: `${(col.days / totalGridDays) * 100}%` }}
                            />
                          ))}
                          {/* today marker */}
                          {todayPct !== null && (
                            <div
                              className="timeline-today-marker"
                              style={{ left: `${todayPct}%` }}
                              title="Today"
                            />
                          )}
                          {/* bar */}
                          <div
                            className="timeline-bar"
                            style={{
                              ...barStyle,
                              background: color.bg,
                              borderColor: color.border,
                            }}
                            onClick={() => startEdit(phase)}
                            title={`${phase.name}: ${phase.startDate} → ${phase.endDate} (${phase.progress}%)`}
                          >
                            <div
                              className="timeline-bar-progress"
                              style={{
                                width: `${phase.progress}%`,
                                background: color.dot,
                              }}
                            />
                            <span className="timeline-bar-label">{phase.name}</span>
                            {/* drag handles */}
                            <div
                              className="timeline-bar-handle timeline-bar-handle-start"
                              onPointerDown={(e) => handlePointerDown(e, phase.id, "start")}
                            />
                            <div
                              className="timeline-bar-handle timeline-bar-handle-end"
                              onPointerDown={(e) => handlePointerDown(e, phase.id, "end")}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Edit / Add Panel ── */}
            {isEditing && (
              <div className="timeline-edit-panel">
                <h3 className="timeline-edit-panel-title">
                  {addingPhase ? "Add Phase" : "Edit Phase"}
                </h3>
                <div className="timeline-edit-fields">
                  <label className="timeline-edit-field">
                    <span className="timeline-edit-field-label">Name</span>
                    <input
                      type="text"
                      className="timeline-edit-input"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="Phase name"
                      autoFocus
                    />
                  </label>
                  <label className="timeline-edit-field">
                    <span className="timeline-edit-field-label">Color</span>
                    <div className="timeline-color-picker">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`timeline-color-swatch${draftColor === c.id ? " is-selected" : ""}`}
                          style={{ background: c.dot }}
                          onClick={() => setDraftColor(c.id)}
                          title={c.id}
                          aria-label={c.id}
                        />
                      ))}
                    </div>
                  </label>
                  <label className="timeline-edit-field">
                    <span className="timeline-edit-field-label">Start Date</span>
                    <input
                      type="date"
                      className="timeline-edit-input"
                      value={draftStartDate}
                      onChange={(e) => setDraftStartDate(e.target.value)}
                    />
                  </label>
                  <label className="timeline-edit-field">
                    <span className="timeline-edit-field-label">End Date</span>
                    <input
                      type="date"
                      className="timeline-edit-input"
                      value={draftEndDate}
                      onChange={(e) => setDraftEndDate(e.target.value)}
                    />
                  </label>
                  <label className="timeline-edit-field">
                    <span className="timeline-edit-field-label">
                      Progress: {draftProgress}%
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      className="timeline-edit-range"
                      value={draftProgress}
                      onChange={(e) => setDraftProgress(Number(e.target.value))}
                    />
                  </label>
                </div>
                <div className="timeline-edit-actions">
                  <button type="button" className="timeline-edit-save" onClick={saveEdit}>
                    {addingPhase ? "Add" : "Save"}
                  </button>
                  <button type="button" className="timeline-edit-cancel" onClick={cancelEdit}>
                    Cancel
                  </button>
                  {editingPhaseId && (
                    <button
                      type="button"
                      className="timeline-edit-delete"
                      onClick={() => deletePhase(editingPhaseId)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Summary Footer ── */}
            {phases.length > 0 && (
              <div className="timeline-summary-footer">
                <span>{stats.total} phase{stats.total !== 1 ? "s" : ""} tracked</span>
                <span className="timeline-summary-sep">·</span>
                <span>{stats.inProgress} in progress</span>
                <span className="timeline-summary-sep">·</span>
                <span>{stats.upcoming} upcoming</span>
                <span className="timeline-summary-sep">·</span>
                <span>{stats.completed} complete</span>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
