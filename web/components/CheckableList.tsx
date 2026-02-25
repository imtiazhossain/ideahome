import React, { useEffect, useRef, useState } from "react";
import { SectionLoadingSpinner } from "./SectionLoadingSpinner";

const IconGrip = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export interface CheckableListItem {
  id: string;
  name: string;
  done: boolean;
}

export interface CheckableListProps {
  items: CheckableListItem[];
  itemLabel: string;
  emptyMessage?: string;
  loading?: boolean;
  isItemDisabled?: (item: CheckableListItem) => boolean;
  editingIndex: number | null;
  editingValue: string;
  onEditingValueChange: (value: string) => void;
  onStartEdit: (index: number) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleDone: (index: number) => void;
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function CheckableList({
  items,
  itemLabel,
  emptyMessage = "No items yet. Add one above.",
  loading = false,
  isItemDisabled,
  editingIndex,
  editingValue,
  onEditingValueChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleDone,
  onRemove,
  onReorder,
}: CheckableListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef<{
    sourceIndex: number;
    targetIndex: number;
    startY: number;
    itemTops: number[];
    itemHeight: number;
  } | null>(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const [isDragging, setIsDragging] = useState(false);

  const applyTransforms = (
    sourceIdx: number,
    targetIdx: number,
    deltaY: number
  ) => {
    const ul = listRef.current;
    if (!ul) return;
    const children = Array.from(ul.children) as HTMLElement[];
    const drag = dragRef.current;
    if (!drag) return;
    const h = drag.itemHeight;
    const lo = Math.min(sourceIdx, targetIdx);
    const hi = Math.max(sourceIdx, targetIdx);
    const direction = targetIdx > sourceIdx ? -1 : 1;

    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      if (i === sourceIdx) {
        el.style.transform = `translateY(${deltaY}px)`;
        el.style.transition = "none";
        el.style.zIndex = "10";
        el.style.position = "relative";
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
      } else if (i >= lo && i <= hi) {
        el.style.transform = `translateY(${direction * h}px)`;
        el.style.transition = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
        el.style.zIndex = "";
        el.style.position = "";
        el.style.boxShadow = "";
      } else {
        el.style.transform = "";
        el.style.transition = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
        el.style.zIndex = "";
        el.style.position = "";
        el.style.boxShadow = "";
      }
    }
  };

  const clearAllTransforms = () => {
    const ul = listRef.current;
    if (!ul) return;
    Array.from(ul.children).forEach((child) => {
      const el = child as HTMLElement;
      el.style.transform = "";
      el.style.transition = "";
      el.style.zIndex = "";
      el.style.position = "";
      el.style.boxShadow = "";
    });
  };

  const handleGripPointerDown = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    const ul = listRef.current;
    if (!ul) return;
    const children = Array.from(ul.children) as HTMLElement[];
    if (children.length === 0) return;

    const itemTops = children.map((c) => c.getBoundingClientRect().top);
    const firstRect = children[0].getBoundingClientRect();
    const itemHeight = firstRect.height + 6;

    dragRef.current = {
      sourceIndex: index,
      targetIndex: index,
      startY: e.clientY,
      itemTops,
      itemHeight,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaY = e.clientY - drag.startY;
      const sourceIdx = drag.sourceIndex;
      const h = drag.itemHeight;

      let targetIdx = sourceIdx + Math.round(deltaY / h);
      targetIdx = Math.max(0, Math.min(targetIdx, items.length - 1));
      drag.targetIndex = targetIdx;

      applyTransforms(sourceIdx, targetIdx, deltaY);
    };

    const onPointerUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      const { sourceIndex, targetIndex } = drag;

      clearAllTransforms();

      if (sourceIndex !== targetIndex) {
        onReorderRef.current(sourceIndex, targetIndex);
      }

      dragRef.current = null;
      setIsDragging(false);
    };

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isDragging, items.length]);

  if (loading) {
    return <SectionLoadingSpinner />;
  }
  if (items.length === 0) {
    return <p className="tests-page-section-desc">{emptyMessage}</p>;
  }

  return (
    <ul
      ref={listRef}
      className="features-list"
      style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}
    >
      {items.map((item, index) => {
        const disabled = isItemDisabled?.(item) ?? false;
        return (
          <li
            key={item.id}
            className={`features-list-item ${item.done ? "features-list-item--done" : ""}`}
          >
            {editingIndex === index ? (
              <>
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => onEditingValueChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSaveEdit();
                    if (e.key === "Escape") onCancelEdit();
                  }}
                  className="project-nav-search"
                  style={{ flex: 1, padding: "6px 10px" }}
                  aria-label={`Edit ${itemLabel}`}
                  autoFocus
                />
                <button
                  type="button"
                  className="features-list-save"
                  onClick={onSaveEdit}
                  aria-label="Save"
                  title="Save"
                >
                  Save
                </button>
                <button
                  type="button"
                  className="features-list-remove"
                  onClick={onCancelEdit}
                  aria-label="Cancel"
                  title="Cancel"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="features-list-done-toggle"
                  onClick={() => !disabled && onToggleDone(index)}
                  disabled={disabled}
                  aria-label={
                    item.done
                      ? `Mark "${item.name}" not done`
                      : `Mark "${item.name}" done`
                  }
                  title={item.done ? "Mark not done" : "Mark done"}
                >
                  {item.done ? (
                    <span className="features-list-done-check" aria-hidden>
                      <IconCheck />
                    </span>
                  ) : (
                    <span className="features-list-done-empty" aria-hidden />
                  )}
                </button>
                <span
                  className="features-list-grip"
                  onPointerDown={(e) =>
                    !disabled && handleGripPointerDown(e, index)
                  }
                  aria-label={`Drag to reorder: ${item.name}`}
                  title="Drag to reorder"
                >
                  <IconGrip />
                </span>
                <span className="features-list-label">{item.name}</span>
                {item.done && (
                  <span className="features-list-done-badge" aria-label="Done">
                    Done
                  </span>
                )}
                <button
                  type="button"
                  className="features-list-edit"
                  onClick={() => onStartEdit(index)}
                  disabled={disabled}
                  aria-label={`Edit ${item.name}`}
                  title={`Edit "${item.name}"`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="features-list-remove"
                  onClick={() => !disabled && onRemove(index)}
                  disabled={disabled}
                  aria-label={`Remove ${item.name}`}
                  title={`Remove "${item.name}"`}
                >
                  Remove
                </button>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
