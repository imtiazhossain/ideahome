import React, {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
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
  type SummaryDashboardData,
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

const AREA_HREFS = {
  todos: "/todo",
  features: "/features",
  enhancements: "/enhancements",
  ideas: "/ideas",
  bugs: "/bugs",
} as const;

export default function SummaryPage() {
  const layout = useProjectLayout();
  const theme = useTheme();
  const requestVersionRef = useRef(0);
  const [dashboard, setDashboard] = useState<SummaryDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedProjectId = layout.selectedProjectId;

  useEffect(() => {
    if (!layout.projectsLoaded) return;
    if (!selectedProjectId) {
      setDashboard(null);
      setLoading(false);
      setError(null);
      return;
    }

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const cached = getCachedSummaryLists(selectedProjectId);

    if (cached) {
      startTransition(() => {
        setDashboard(cached.data);
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
          setDashboard(result.data);
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
    () => (dashboard ? aggregateSummaryViewModel(dashboard.lists) : null),
    [dashboard]
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
            A colorful progress snapshot for delivery, spend, testing, and
            calendar activity.
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
                <h2>No Project Selected</h2>
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
                      <Link
                        href="/todo"
                        prefetch={false}
                        className="summary-hero-chip summary-inline-link"
                      >
                        {summary.totalItems} tracked items
                      </Link>
                      <Link
                        href="/todo"
                        prefetch={false}
                        className="summary-hero-chip summary-inline-link"
                      >
                        {summary.openItems} still open
                      </Link>
                      <Link
                        href="/bugs"
                        prefetch={false}
                        className="summary-hero-chip summary-inline-link"
                      >
                        {summary.openBugs} blockers
                      </Link>
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
                    href="/todo"
                  />
                  <SummaryStatCard
                    title="Open Work"
                    value={summary.openItems}
                    detail={`${summary.totalItems} total items in scope`}
                    accentClassName="is-open"
                    href="/todo"
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
                    href="/bugs"
                  />
                  <SummaryStatCard
                    title="7-Day Momentum"
                    value={summary.momentumCount}
                    detail={formatDelta(summary.momentumDelta)}
                    accentClassName="is-momentum"
                    href="/"
                  />
                </section>

                {summary.totalItems === 0 ? (
                  <section className="summary-empty-state" aria-live="polite">
                    <h2>No Project Data Yet</h2>
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
                          <h2>Open vs Completed by Area</h2>
                        </div>
                        <SummarySplitBarChart
                          areas={summary.areas}
                          getHref={(key) => AREA_HREFS[key]}
                        />
                      </article>

                      <Link
                        href="/"
                        prefetch={false}
                        className="summary-panel summary-panel-link"
                        aria-label="Open board"
                      >
                        <div className="summary-panel-heading">
                          <p className="summary-panel-eyebrow">
                            Recent Activity
                          </p>
                          <h2>7-Day Movement</h2>
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
                      </Link>
                    </section>

                    <section className="summary-supplemental-grid">
                      <Link
                        href="/finances"
                        prefetch={false}
                        className="summary-panel summary-panel-link summary-panel-accent-blue"
                        aria-label="Open finances"
                      >
                        <div className="summary-panel-heading">
                          <p className="summary-panel-eyebrow">Expenses</p>
                          <h2>Spend Snapshot</h2>
                        </div>
                        <div className="summary-metric-stack">
                          <strong className="summary-metric-value">
                            {dashboard?.expenses.recentAmount.toLocaleString(
                              undefined,
                              {
                                style: "currency",
                                currency: "USD",
                                maximumFractionDigits: 0,
                              }
                            )}
                          </strong>
                          <p className="summary-metric-caption">
                            This month, {dashboard?.expenses.expenseCount ?? 0}{" "}
                            expenses tracked
                          </p>
                          <div className="summary-meta-list">
                            <div className="summary-meta-row">
                              <span>Total spend</span>
                              <strong>
                                {dashboard?.expenses.totalAmount.toLocaleString(
                                  undefined,
                                  {
                                    style: "currency",
                                    currency: "USD",
                                    maximumFractionDigits: 0,
                                  }
                                )}
                              </strong>
                            </div>
                            <div className="summary-meta-row">
                              <span>Top category</span>
                              <strong>
                                {dashboard?.expenses.topCategory ??
                                  "No category yet"}
                              </strong>
                            </div>
                          </div>
                          <p className="summary-supporting-copy">
                            {dashboard?.expenses.latestExpenseLabel}
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/tests"
                        prefetch={false}
                        className="summary-panel summary-panel-link summary-panel-accent-amber"
                        aria-label="Open tests"
                      >
                        <div className="summary-panel-heading">
                          <p className="summary-panel-eyebrow">
                            Testing Health
                          </p>
                          <h2>Coverage Readiness</h2>
                        </div>
                        <div className="summary-metric-stack">
                          <strong className="summary-metric-value">
                            {(dashboard?.testing.apiTestCount ?? 0) +
                              (dashboard?.testing.uiTestCount ?? 0)}
                          </strong>
                          <p className="summary-metric-caption">
                            {dashboard?.testing.healthLabel ??
                              "Coverage mapped"}
                          </p>
                          <div className="summary-meta-list">
                            <div className="summary-meta-row">
                              <span>API tests</span>
                              <strong>
                                {dashboard?.testing.apiTestCount ?? 0}
                              </strong>
                            </div>
                            <div className="summary-meta-row">
                              <span>UI tests</span>
                              <strong>
                                {dashboard?.testing.uiTestCount ?? 0}
                              </strong>
                            </div>
                            <div className="summary-meta-row">
                              <span>Suites</span>
                              <strong>
                                {dashboard?.testing.suiteCount ?? 0}
                              </strong>
                            </div>
                          </div>
                          <p className="summary-supporting-copy">
                            {dashboard?.testing.detail}
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/calendar"
                        prefetch={false}
                        className="summary-panel summary-panel-link summary-panel-accent-teal"
                        aria-label="Open calendar"
                      >
                        <div className="summary-panel-heading">
                          <p className="summary-panel-eyebrow">
                            Calendar Updates
                          </p>
                          <h2>Upcoming Schedule</h2>
                        </div>
                        <div className="summary-metric-stack">
                          <strong className="summary-metric-value">
                            {dashboard?.calendar.upcomingCount ?? 0}
                          </strong>
                          <p className="summary-metric-caption">
                            Upcoming events in the next 7 days
                          </p>
                          <p className="summary-supporting-copy">
                            {dashboard?.calendar.statusLabel}
                          </p>
                          {dashboard?.calendar.connected &&
                          dashboard.calendar.updates.length > 0 ? (
                            <div className="summary-calendar-list">
                              {dashboard.calendar.updates.map((update) => (
                                <div
                                  key={update.id}
                                  className="summary-calendar-list-item"
                                >
                                  <strong>{update.title}</strong>
                                  <span>{update.startsAtLabel}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="summary-supporting-copy">
                              {dashboard?.calendar.connected
                                ? "No upcoming events in the next week."
                                : "Connect Google Calendar to surface sync status and upcoming events here."}
                            </p>
                          )}
                        </div>
                      </Link>
                    </section>

                    <section className="summary-detail-grid">
                      <article className="summary-panel">
                        <div className="summary-panel-heading">
                          <p className="summary-panel-eyebrow">
                            Progress by Area
                          </p>
                          <h2>Completion Detail</h2>
                        </div>
                        <div className="summary-progress-list">
                          {summary.areas.map((area) => (
                            <Link
                              key={area.key}
                              href={AREA_HREFS[area.key]}
                              prefetch={false}
                              className="summary-progress-row summary-inline-link"
                              aria-label={`Open ${area.label}`}
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
                            </Link>
                          ))}
                        </div>
                      </article>

                      <article className="summary-panel">
                        <div className="summary-panel-heading">
                          <p className="summary-panel-eyebrow">
                            Attention Needed
                          </p>
                          <h2>Signals to Watch</h2>
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
                        <h2>Workload by Category</h2>
                      </div>
                      <div className="summary-snapshot-grid">
                        {summary.areas.map((area) => (
                          <Link
                            key={area.key}
                            href={AREA_HREFS[area.key]}
                            prefetch={false}
                            className="summary-snapshot-tile summary-inline-link"
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
                          </Link>
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
