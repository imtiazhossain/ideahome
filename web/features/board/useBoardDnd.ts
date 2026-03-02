import React, { useCallback, useMemo, useState } from "react";
import {
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { STATUSES } from "../../lib/api/issues";
import type { Issue } from "../../lib/api/issues";

export function useBoardDnd(
  issues: Issue[],
  handleStatusChange: (issueId: string, targetStatus: string) => void
) {
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [draggingIssueId, setDraggingIssueId] = useState<string | null>(null);

  const issuesByStatus = useMemo(
    () =>
      STATUSES.reduce(
        (acc, { id }) => {
          acc[id] = issues.filter((i) => i.status === id);
          return acc;
        },
        {} as Record<string, Issue[]>
      ),
    [issues]
  );

  const issuesByStatusForDisplay = useMemo(() => {
    if (!draggingIssueId || !dragOverColumnId) return issuesByStatus;
    const dragged = issues.find((i) => i.id === draggingIssueId);
    if (!dragged) return issuesByStatus;
    const result = { ...issuesByStatus };
    result[dragged.status] = (result[dragged.status] ?? []).filter(
      (i) => i.id !== draggingIssueId
    );
    result[dragOverColumnId] = [...(result[dragOverColumnId] ?? []), dragged];
    return result;
  }, [issuesByStatus, draggingIssueId, dragOverColumnId, issues]);

  const boardSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleBoardDragStart = useCallback((event: DragStartEvent) => {
    const issueId = (event.active.data.current as { issueId?: string } | undefined)
      ?.issueId;
    setDraggingIssueId(issueId ?? null);
  }, []);

  const handleBoardDragOver = useCallback((event: DragOverEvent) => {
    const status = (event.over?.data.current as { status?: string } | undefined)
      ?.status;
    setDragOverColumnId(status ?? null);
  }, []);

  const handleBoardDragEnd = useCallback(
    (event: DragEndEvent) => {
      const issueId = (event.active.data.current as { issueId?: string } | undefined)
        ?.issueId;
      const targetStatus = (event.over?.data.current as { status?: string } | undefined)
        ?.status;
      setDraggingIssueId(null);
      setDragOverColumnId(null);
      if (!issueId || !targetStatus) return;
      const issue = issues.find((item) => item.id === issueId);
      if (!issue || issue.status === targetStatus) return;
      handleStatusChange(issueId, targetStatus);
    },
    [issues, handleStatusChange]
  );

  const handleBoardDragCancel = useCallback(() => {
    setDraggingIssueId(null);
    setDragOverColumnId(null);
  }, []);

  return {
    issuesByStatus,
    issuesByStatusForDisplay,
    boardSensors,
    handleBoardDragStart,
    handleBoardDragOver,
    handleBoardDragEnd,
    handleBoardDragCancel,
    draggingIssueId,
    dragOverColumnId,
  };
}
