import React, { useCallback, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SectionLoadingSpinner } from "./SectionLoadingSpinner";
import { IconCheck } from "./IconCheck";
import { IconGrip } from "./IconGrip";
import { IconTrash } from "./IconTrash";

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
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDelete?: (index: number) => void;
}

interface SortableItemProps {
  item: CheckableListItem;
  index: number;
  itemLabel: string;
  isItemDisabled?: (item: CheckableListItem) => boolean;
  isEditing: boolean;
  editingValue: string;
  onEditingValueChange: (value: string) => void;
  onStartEdit: (index: number) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleDone: (index: number) => void;
  onDelete?: (index: number) => void;
}

const DELETE_BUTTON_WIDTH = 80;
const SWIPE_THRESHOLD = 40;

function SortableItem({
  item,
  index,
  itemLabel,
  isItemDisabled,
  isEditing,
  editingValue,
  onEditingValueChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleDone,
  onDelete,
}: SortableItemProps) {
  const disabled = isItemDisabled?.(item) ?? false;
  const itemRef = useRef<HTMLLIElement | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: isEditing,
  });

  const canSwipe = Boolean(onDelete) && !isEditing;

  const handlePointerStart = useCallback(
    (clientX: number) => {
      if (!canSwipe) return;
      startXRef.current = clientX;
      startOffsetRef.current = swipeOffset;
      setIsSwiping(true);
    },
    [canSwipe, swipeOffset]
  );

  const handlePointerMove = useCallback(
    (clientX: number) => {
      if (!canSwipe || !isSwiping) return;
      const delta = clientX - startXRef.current;
      const next = Math.min(
        0,
        Math.max(-DELETE_BUTTON_WIDTH, startOffsetRef.current + delta)
      );
      setSwipeOffset(next);
    },
    [canSwipe, isSwiping]
  );

  const handlePointerEnd = useCallback(() => {
    if (!isSwiping) return;
    setIsSwiping(false);
    setSwipeOffset((prev) =>
      prev < -SWIPE_THRESHOLD ? -DELETE_BUTTON_WIDTH : 0
    );
  }, [isSwiping]);

  React.useEffect(() => {
    if (!isSwiping) return;
    const onMove = (e: PointerEvent) => handlePointerMove(e.clientX);
    const onUp = () => handlePointerEnd();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [handlePointerEnd, handlePointerMove, isSwiping]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDelete?.(index);
      setSwipeOffset(0);
    },
    [index, onDelete]
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const setRefs = useCallback(
    (node: HTMLLIElement | null) => {
      itemRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  React.useEffect(() => {
    if (swipeOffset === 0) return;
    const onOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (itemRef.current?.contains(target)) return;
      setSwipeOffset(0);
      setIsSwiping(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [swipeOffset]);

  const dragHandle = (
    <span
      className="features-list-drag-handle"
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      title="Drag to reorder"
    >
      <IconGrip />
    </span>
  );

  const deleteHandle = (
    <button
      type="button"
      className="features-list-row-delete"
      onClick={handleDeleteClick}
      aria-label={`Delete ${item.name}`}
      title={`Delete ${item.name}`}
    >
      <IconTrash />
    </button>
  );

  const mainContent = (
    <>
      {isEditing ? (
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
          <span className="features-list-input-wrap">
            <span className="features-list-input-sizer" aria-hidden>
              {editingValue || "\u00A0"}
            </span>
            <input
              type="text"
              value={editingValue}
              onChange={(e) => onEditingValueChange(e.target.value)}
              onBlur={onSaveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              className="features-list-input"
              aria-label={`Edit ${itemLabel}`}
              autoFocus
            />
          </span>
          {item.done && (
            <span className="features-list-done-badge" aria-label="Done">
              Done
            </span>
          )}
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
            className="features-list-label"
            onClick={() => !disabled && onStartEdit(index)}
            onKeyDown={(e) => {
              if (!disabled && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onStartEdit(index);
              }
            }}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`Edit ${item.name}`}
            title={`Edit "${item.name}"`}
            style={{ cursor: disabled ? "default" : "pointer" }}
          >
            {item.name}
          </span>
          {item.done && (
            <span className="features-list-done-badge" aria-label="Done">
              Done
            </span>
          )}
        </>
      )}
    </>
  );

  return (
    <li
      ref={setRefs}
      style={style}
      className={`features-list-item ${item.done ? "features-list-item--done" : ""} ${isDragging ? "features-list-item--dragging" : ""}`}
    >
      {canSwipe ? (
        <div className="features-list-item-swipe-wrap">
          <div
            className="features-list-item-swipe-content"
            style={{
              transform: `translateX(${swipeOffset}px)`,
              transition: isSwiping ? "none" : "transform 0.2s ease-out",
            }}
            onPointerDown={(e) => handlePointerStart(e.clientX)}
          >
            {mainContent}
          </div>
        </div>
      ) : (
        mainContent
      )}
      {canSwipe && swipeOffset <= -SWIPE_THRESHOLD ? deleteHandle : dragHandle}
    </li>
  );
}

export function CheckableList({
  items,
  itemLabel,
  emptyMessage = "No entries yet. Add one above.",
  loading = false,
  isItemDisabled,
  editingIndex,
  editingValue,
  onEditingValueChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleDone,
  onReorder,
  onDelete,
}: CheckableListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(oldIndex, newIndex);
  };

  const handleListClickCapture = (e: React.MouseEvent) => {
    if (editingIndex == null) return;
    const editedLi = listRef.current?.children[editingIndex] as HTMLElement;
    const inputWrap = editedLi?.querySelector(".features-list-input-wrap");
    if (inputWrap?.contains(e.target as Node)) return;
    onSaveEdit();
  };

  if (loading) {
    return <SectionLoadingSpinner />;
  }
  if (items.length === 0) {
    return <p className="tests-page-section-desc">{emptyMessage}</p>;
  }

  const itemIds = items.map((i) => i.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <ul
          ref={listRef}
          className="features-list"
          style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}
          onClickCapture={handleListClickCapture}
        >
          {items.map((item, index) => (
            <SortableItem
              key={item.id}
              item={item}
              index={index}
              itemLabel={itemLabel}
              isItemDisabled={isItemDisabled}
              isEditing={editingIndex === index}
              editingValue={editingValue}
              onEditingValueChange={onEditingValueChange}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onToggleDone={onToggleDone}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
