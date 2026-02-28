import React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Issue } from "../../lib/api";
import { issueKey } from "./issue-key";
import { computeQualityScore, getQualityScoreColor } from "./scoring";

function AssigneeAvatar({ issue }: { issue: Issue }) {
  if (!issue.assignee) return null;
  const initial = (issue.assignee.name || issue.assignee.email)
    .slice(0, 1)
    .toUpperCase();
  return (
    <div className="assignee-avatar" title={issue.assignee.email}>
      {initial}
    </div>
  );
}

export function IssueCard({
  issue,
  onSelect,
  draggingIssueId,
  isPreview,
}: {
  issue: Issue;
  onSelect: (issue: Issue) => void;
  draggingIssueId: string | null;
  isPreview?: boolean;
}) {
  const suppressClickRef = React.useRef(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `issue-${issue.id}`,
      data: {
        issueId: issue.id,
        status: issue.status,
      },
    });
  const scoreDisplay = Math.round((computeQualityScore(issue) / 6) * 100);
  const scoreColor = getQualityScoreColor(scoreDisplay);
  const scoreTextColor =
    scoreDisplay >= 40 && scoreDisplay <= 65 ? "#1a1a1a" : "#fff";

  React.useEffect(() => {
    if (!isDragging) return;
    suppressClickRef.current = true;
  }, [isDragging]);

  React.useEffect(() => {
    if (draggingIssueId !== null) return;
    if (!suppressClickRef.current) return;
    const timer = window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 30);
    return () => window.clearTimeout(timer);
  }, [draggingIssueId]);

  const handleClick = () => {
    if (suppressClickRef.current || isDragging) {
      return;
    }
    onSelect(issue);
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? "none" : undefined,
    zIndex: isDragging ? 5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`issue-card${isPreview ? " issue-card-preview" : ""}`}
      onClick={handleClick}
      {...listeners}
      {...attributes}
    >
      <div
        className="issue-card-quality-score"
        title={`Quality Score: ${scoreDisplay}/100`}
        style={{
          background: scoreColor,
          borderColor: scoreColor,
          color: scoreTextColor,
        }}
      >
        {scoreDisplay}
      </div>
      <div className="issue-card-title">{issue.title}</div>
      <div className="issue-card-meta">
        <span className="issue-key">{issueKey(issue)}</span>
        <AssigneeAvatar issue={issue} />
      </div>
    </div>
  );
}

export function BoardColumn({
  id,
  label,
  count,
  isDropTarget,
  children,
}: {
  id: string;
  label: string;
  count: number;
  isDropTarget: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${id}`,
    data: { status: id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`column column-${id}${isDropTarget ? " column-drop-target" : ""}`}
    >
      <div className="column-header">
        <span className="column-title">{label}</span>
        <span className="column-count">{count}</span>
      </div>
      {children}
    </div>
  );
}
