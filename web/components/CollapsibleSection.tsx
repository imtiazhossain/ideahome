import React, { useEffect, useMemo, useRef, useState } from "react";
import { getStoredSelectedProjectId } from "../lib/SelectedProjectContext";

function buildSectionStorageKey(
  prefix: "ideahome-section-height" | "ideahome-section-full-height",
  pathname: string,
  projectId: string,
  sectionId: string
): string {
  return `${prefix}:${pathname}:${projectId || "none"}:${sectionId}`;
}

function readStoredSectionValue(
  primaryKey: string | null,
  fallbackKey: string | null
): string | null {
  if (typeof window === "undefined" || !primaryKey) return null;
  try {
    const primaryValue = localStorage.getItem(primaryKey);
    if (primaryValue != null) return primaryValue;
    if (!fallbackKey || fallbackKey === primaryKey) return null;
    const fallbackValue = localStorage.getItem(fallbackKey);
    if (fallbackValue == null) return null;
    localStorage.setItem(primaryKey, fallbackValue);
    localStorage.removeItem(fallbackKey);
    return fallbackValue;
  } catch {
    return null;
  }
}

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
  /** Whether section body can be resized and persisted. Defaults to true. */
  resizable?: boolean;
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
  resizable = true,
}: CollapsibleSectionProps) {
  const bodyId = `${sectionId}-body`;
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const storageKeys = useMemo(() => {
    if (typeof window === "undefined" || !resizable) return null;
    const pathname = window.location.pathname || "unknown";
    const projectId = getStoredSelectedProjectId();
    return {
      sectionHeightStorageKey: buildSectionStorageKey(
        "ideahome-section-height",
        pathname,
        projectId,
        sectionId
      ),
      sectionHeightFallbackStorageKey: projectId
        ? buildSectionStorageKey(
            "ideahome-section-height",
            pathname,
            "",
            sectionId
          )
        : null,
      sectionFullHeightStorageKey: buildSectionStorageKey(
        "ideahome-section-full-height",
        pathname,
        projectId,
        sectionId
      ),
      sectionFullHeightFallbackStorageKey: projectId
        ? buildSectionStorageKey(
            "ideahome-section-full-height",
            pathname,
            "",
            sectionId
          )
        : null,
    };
  }, [resizable, sectionId]);
  const [bodyHeight, setBodyHeight] = useState<number | null>(null);
  const [fullHeight, setFullHeight] = useState(false);
  const bodyHeightBeforeFullRef = useRef<number | null>(null);
  const skipNextFullHeightPersistRef = useRef(true);
  const sectionHeightStorageKey = storageKeys?.sectionHeightStorageKey ?? null;
  const sectionHeightFallbackStorageKey =
    storageKeys?.sectionHeightFallbackStorageKey ?? null;
  const sectionFullHeightStorageKey =
    storageKeys?.sectionFullHeightStorageKey ?? null;
  const sectionFullHeightFallbackStorageKey =
    storageKeys?.sectionFullHeightFallbackStorageKey ?? null;

  useEffect(() => {
    if (!sectionHeightStorageKey || typeof window === "undefined") return;
    try {
      const raw = readStoredSectionValue(
        sectionHeightStorageKey,
        sectionHeightFallbackStorageKey
      );
      if (!raw) {
        setBodyHeight(null);
        return;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setBodyHeight(null);
        return;
      }
      setBodyHeight(Math.round(parsed));
    } catch {
      setBodyHeight(null);
    }
  }, [sectionHeightFallbackStorageKey, sectionHeightStorageKey]);

  useEffect(() => {
    if (!sectionFullHeightStorageKey || typeof window === "undefined") return;
    try {
      setFullHeight(
        readStoredSectionValue(
          sectionFullHeightStorageKey,
          sectionFullHeightFallbackStorageKey
        ) === "1"
      );
    } catch {
      setFullHeight(false);
    }
    bodyHeightBeforeFullRef.current = null;
    skipNextFullHeightPersistRef.current = true;
  }, [sectionFullHeightFallbackStorageKey, sectionFullHeightStorageKey]);

  useEffect(() => {
    if (!sectionHeightStorageKey || typeof window === "undefined") return;
    try {
      if (fullHeight) return;
      if (bodyHeight == null) {
        localStorage.removeItem(sectionHeightStorageKey);
        return;
      }
      localStorage.setItem(sectionHeightStorageKey, String(bodyHeight));
    } catch {
      // ignore storage errors
    }
  }, [bodyHeight, fullHeight, sectionHeightStorageKey]);

  useEffect(() => {
    if (!sectionFullHeightStorageKey || typeof window === "undefined") {
      return;
    }
    if (skipNextFullHeightPersistRef.current) {
      skipNextFullHeightPersistRef.current = false;
      return;
    }
    try {
      if (fullHeight) {
        localStorage.setItem(sectionFullHeightStorageKey, "1");
        return;
      }
      localStorage.removeItem(sectionFullHeightStorageKey);
    } catch {
      // ignore storage errors
    }
  }, [fullHeight, sectionFullHeightStorageKey]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !resizable ||
      collapsed ||
      fullHeight ||
      bodyRef.current == null
    ) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextHeight = Math.round(entry.contentRect.height);
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
      setBodyHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    });
    observer.observe(bodyRef.current);
    return () => observer.disconnect();
  }, [collapsed, fullHeight, resizable, sectionHeightStorageKey]);

  const toggleFullHeight = () => {
    if (collapsed || !resizable) return;
    setFullHeight((prev) => {
      if (!prev) {
        if (bodyHeight != null) {
          bodyHeightBeforeFullRef.current = bodyHeight;
        } else {
          const measured = bodyRef.current?.getBoundingClientRect().height;
          bodyHeightBeforeFullRef.current =
            measured && Number.isFinite(measured) && measured > 0
              ? Math.round(measured)
              : null;
        }
        return true;
      }
      setBodyHeight(bodyHeightBeforeFullRef.current ?? bodyHeight);
      bodyHeightBeforeFullRef.current = null;
      return false;
    });
  };

  return (
    <section
      className={`tests-page-section ${sectionClassName}`.trim()}
      aria-labelledby={headingId || undefined}
      data-collapsed={collapsed ? "true" : "false"}
      data-full-height={fullHeight ? "true" : "false"}
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
        {(resizable && !collapsed) || headerTrailing != null ? (
          <div className="collapsible-section-header-actions">
            {resizable && !collapsed ? (
              <button
                type="button"
                className="collapsible-section-size-toggle features-list-drag-handle"
                onClick={toggleFullHeight}
                aria-label={
                  fullHeight ? "Minimize Section Height" : "Expand Section Height"
                }
                title={
                  fullHeight ? "Minimize Section Height" : "Expand Section Height"
                }
              >
                {fullHeight ? <MinimizeIcon /> : <ExpandIcon />}
              </button>
            ) : null}
            {headerTrailing != null ? headerTrailing : null}
          </div>
        ) : null}
      </div>
      <div
        ref={bodyRef}
        id={bodyId}
        hidden={collapsed}
        className={`collapsible-section-body${resizable ? " is-resizable" : ""}`}
        style={
          fullHeight
            ? { height: "auto", overflow: "visible" }
            : bodyHeight != null
              ? { height: `${bodyHeight}px` }
              : undefined
        }
      >
        {children}
      </div>
    </section>
  );
}

function ExpandIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 4H4v4" />
      <path d="M4 4l6 6" />
      <path d="M16 20h4v-4" />
      <path d="M20 20l-6-6" />
      <path d="M16 4h4v4" />
      <path d="M20 4l-6 6" />
      <path d="M8 20H4v-4" />
      <path d="M4 20l6-6" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 10H4V4" />
      <path d="M4 4l6 6" />
      <path d="M14 14h6v6" />
      <path d="M20 20l-6-6" />
      <path d="M14 10h6V4" />
      <path d="M20 4l-6 6" />
      <path d="M10 14H4v6" />
      <path d="M4 20l6-6" />
    </svg>
  );
}
