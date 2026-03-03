import React from "react";

export interface CollapsibleSectionProps {
  /** Unique id for the section body (aria-controls, id). */
  sectionId: string;
  /** Section title and optional count/badge (e.g. "Summary", "Expenses 4"). */
  title: React.ReactNode;
  /** Whether the section body is collapsed. */
  collapsed: boolean;
  /** Called when the header toggle is clicked. */
  onToggle: () => void;
  /** Section body content. */
  children: React.ReactNode;
  /** Extra class name(s) for the section element (e.g. "expenses-summary-section"). */
  sectionClassName?: string;
  /** Optional content at the start of the header row. */
  headerLeading?: React.ReactNode;
  /** Optional content in the header row shown only when expanded (e.g. filters, controls). */
  headerExtra?: React.ReactNode;
  /** Optional content at the end of the header row (e.g. drag handle). */
  headerTrailing?: React.ReactNode;
  /** Optional aria label for the section (e.g. for aria-labelledby on the section). */
  headingId?: string;
}

/**
 * A section with a clickable header that toggles collapse. Use the same
 * tests-page-section-toggle-inline styling as the expenses list section.
 * New sections can use this component to get collapse behavior by default.
 */
export function CollapsibleSection({
  sectionId,
  title,
  collapsed,
  onToggle,
  children,
  sectionClassName = "",
  headerLeading,
  headerExtra,
  headerTrailing,
  headingId,
}: CollapsibleSectionProps) {
  const bodyId = `${sectionId}-body`;
  return (
    <section
      className={`tests-page-section ${sectionClassName}`.trim()}
      aria-labelledby={headingId || undefined}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="expenses-list-section-header">
        {headerLeading != null ? headerLeading : null}
        <button
          type="button"
          className={`tests-page-section-toggle-inline${collapsed ? " is-collapsed" : ""}`}
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          aria-label={collapsed ? "Expand section" : "Collapse section"}
        >
          <span className="tests-page-section-toggle-chevron" aria-hidden="true">
            ▶
          </span>
          <h2
            id={headingId}
            className="tests-page-section-title"
            style={{ margin: 0 }}
          >
            {title}
          </h2>
        </button>
        {headerExtra != null && !collapsed ? headerExtra : null}
        {headerTrailing != null ? headerTrailing : null}
      </div>
      <div id={bodyId} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}
