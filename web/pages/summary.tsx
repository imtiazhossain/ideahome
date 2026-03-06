import React, {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppLayout } from "../components/AppLayout";
import { ErrorBanner } from "../components/ErrorBanner";
import { SectionLoadingSpinner } from "../components/SectionLoadingSpinner";
import {
  SummaryDonutChart,
  SummarySplitBarChart,
  SummaryTrendChart,
} from "../components/summary/SummaryCharts";
import { SummaryStatCard } from "../components/summary/SummaryStatCard";
import {
  aggregateSummaryViewModel,
  fetchSummaryLists,
  getCachedSummaryLists,
  type SummaryLists,
} from "../lib/summary";
import { useProjectLayout } from "../lib/useProjectLayout";
import { useTheme } from "./_app";

function formatDelta(value: number): string {
  if (value > 0) return `+${value} net vs blockers`;
  if (value < 0) return `${value} net vs blockers`;
  return "Even with blocker load";
}

function insightClassName(tone: "success" | "warning" | "danger" | "neutral") {
  switch (tone) {
    case "success":
      return "is-success";
    case "warning":
      return "is-warning";
    case "danger":
      return "is-danger";
    default:
      return "is-neutral";
  }
}

export default function SummaryPage() {
  const layout = useProjectLayout();
  const theme = useTheme();
  const requestVersionRef = useRef(0);
  const [lists, setLists] = useState<SummaryLists | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedProjectId = layout.selectedProjectId;

  useEffect(() => {
    if (!layout.projectsLoaded) return;
    if (!selectedProjectId) {
      setLists(null);
      setLoading(false);
      setError(null);
      return;
    }

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const cached = getCachedSummaryLists(selectedProjectId);

    if (cached) {
      startTransition(() => {
        setLists(cached.lists);
        setLoading(false);
        setError(null);
      });
    } else {
      setLoading(true);
      setError(null);
    }

    void fetchSummaryLists(selectedProjectId)
      .then((result) => {
        if (requestVersionRef.current !== requestVersion) return;
        startTransition(() => {
          setLists(result.lists);
          setLoading(false);
          setError(null);
        });
      })
      .catch((err: unknown) => {
        if (requestVersionRef.current !== requestVersion) return;
        setLoading(false);
        setError(
          err instanceof Error ? err.message : "Failed to load summary."
        );
      });
  }, [layout.projectsLoaded, selectedProjectId]);

  const summary = useMemo(
    () => (lists ? aggregateSummaryViewModel(lists) : null),
    [lists]
  );

  const { theme: themeValue, toggleTheme } = theme;
  const appLayoutProps = {
    title: "Summary · Idea Home",
    activeTab: "summary" as const,
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
    theme: themeValue,
    toggleTheme,
    projectToDelete: layout.projectToDelete,
    setProjectToDelete: layout.setProjectToDelete,
    projectDeleting: layout.projectDeleting,
    handleDeleteProject: layout.handleDeleteProject,
    onCreateProject: layout.createProjectByName,
    onRenameProject: layout.renameProjectById,
  };

  return (
    <AppLayout {...appLayoutProps}>
      <div className="summary-page">
        <div className="summary-page-header">
          <p className="summary-page-eyebrow">Operations</p>
          <h1 className="summary-page-title">Summary</h1>
          <p className="summary-page-subtitle">
            A colorful progress snapshot for the currently selected project.
          </p>
        </div>

        {!layout.projectsLoaded || (loading && !summary) ? (
          <div className="summary-page-loading">
            <SectionLoadingSpinner />
          </div>
        ) : (
          <>
            {error ? <ErrorBanner message={error} /> : null}

            {!selectedProjectId ? (
              <section className="summary-empty-state" aria-live="polite">
                <h2>No project selected</h2>
                <p>
                  Select a project to see progress, blocker pressure, and recent
                  momentum.
                </p>
              </section>
            ) : summary ? (
              <>
                <section className="summary-hero">
                  <div className="summary-hero-copy">
                    <p className="summary-hero-kicker">Project Pulse</p>
                    <h2 className="summary-hero-title">
                      {layout.projectDisplayName}
                    </h2>
                    <p className="summary-hero-text">{summary.statusText}</p>
                    <div
                      className="summary-hero-chip-row"
                      aria-label="Summary quick stats"
                    >
                      <span className="summary-hero-chip">
                        {summary.totalItems} tracked items
                      </span>
                      <span className="summary-hero-chip">
                        {summary.openItems} still open
                      </span>
                      <span className="summary-hero-chip">
                        {summary.openBugs} blockers
                      </span>
                    </div>
                  </div>
                  <SummaryDonutChart
                    percent={summary.completionRate}
                    completed={summary.completedItems}
                    total={summary.totalItems}
                  />
                </section>

                <section
                  className="summary-stat-grid"
                  aria-label="Primary summary metrics"
                >
                  <SummaryStatCard
                    title="Completed Items"
                    value={summary.completedItems}
                    detail={`${Math.round(summary.completionRate)}% of tracked work`}
                    accentClassName="is-complete"
                  />
                  <SummaryStatCard
                    title="Open Work"
                    value={summary.openItems}
                    detail={`${summary.totalItems} total items in scope`}
                    accentClassName="is-open"
                  />
                  <SummaryStatCard
                    title="Blockers"
                    value={summary.openBugs}
                    detail={
                      summary.openBugs === 0
                        ? "No open bugs currently tracked"
                        : "Open bugs needing attention"
                    }
                    accentClassName="is-bugs"
                  />
                  <SummaryStatCard
                    title="7-Day Momentum"
                    value={summary.momentumCount}
                    detail={formatDelta(summary.momentumDelta)}
                    accentClassName="is-momentum"
                  />
                </section>

                {summary.totalItems === 0 ? (
                  <section className="summary-empty-state" aria-live="polite">
                    <h2>No project data yet</h2>
                    <p>
                      Add to-dos, features, ideas, enhancements, or bugs to
                      populate charts and reveal progress over time.
                    </p>
                  </section>
                ) : (
                  <>
                    <section className="summary-chart-grid">
                      <article className="summary-panel">
                        <div className="summary-panel-heading">
                          <p className="summary-panel-eyebrow">Work Mix</p>
                          <h2>Open vs completed by area</h2>
                        </div>
                        <SummarySplitBarChart areas={summary.areas} />
                      </article>

                      <article className="summary-panel">
                        <div className="summary-panel-heading">
                          <p className="summary-panel-eyebrow">
                            Recent Activity
                          </p>
                          <h2>7-day movement</h2>
                        </div>
                        <div
                          className="summary-trend-legend"
                          aria-hidden="true"
                        >
                          <span>
                            <i className="summary-legend-dot is-created" />
                            Created
                          </span>
                          <span>
                            <i className="summary-legend-dot is-completed" />
                            Done estimate
                          </span>
                        </div>
                        <SummaryTrendChart points={summary.trend} />
                      </article>
                    </section>

                    <section className="summary-detail-grid">
                      <article className="summary-panel">
                        <div className="summary-panel-heading">
                          <p className="summary-panel-eyebrow">
                            Progress by Area
                          </p>
                          <h2>Completion detail</h2>
                        </div>
                        <div className="summary-progress-list">
                          {summary.areas.map((area) => (
                            <div
                              key={area.key}
                              className="summary-progress-row"
                            >
                              <div className="summary-progress-row-head">
                                <span>{area.label}</span>
                                <span>
                                  {Math.round(area.completionRate)}% ·{" "}
                                  {area.completed}/{area.total}
                                </span>
                              </div>
                              <div className="summary-progress-track">
                                <div
                                  className="summary-progress-fill"
                                  style={{
                                    width: `${area.completionRate}%`,
                                    background: `var(${area.colorVar})`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>

                      <article className="summary-panel">
                        <div className="summary-panel-heading">
                          <p className="summary-panel-eyebrow">
                            Attention Needed
                          </p>
                          <h2>Signals to watch</h2>
                        </div>
                        <div className="summary-insight-list">
                          {summary.insights.map((insight) => (
                            <article
                              key={insight.id}
                              className={`summary-insight-card ${insightClassName(insight.tone)}`}
                            >
                              <strong>{insight.title}</strong>
                              <p>{insight.detail}</p>
                            </article>
                          ))}
                        </div>
                      </article>
                    </section>

                    <section className="summary-panel summary-snapshot-panel">
                      <div className="summary-panel-heading">
                        <p className="summary-panel-eyebrow">Snapshot</p>
                        <h2>Workload by category</h2>
                      </div>
                      <div className="summary-snapshot-grid">
                        {summary.areas.map((area) => (
                          <article
                            key={area.key}
                            className="summary-snapshot-tile"
                            style={{
                              borderColor: `color-mix(in srgb, var(${area.colorVar}) 36%, var(--border))`,
                            }}
                          >
                            <span
                              className="summary-snapshot-dot"
                              style={{ background: `var(${area.colorVar})` }}
                            />
                            <div>
                              <p>{area.label}</p>
                              <strong>{area.total}</strong>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </>
            ) : null}
          </>
        )}
      </div>
    </AppLayout>
  );
}
