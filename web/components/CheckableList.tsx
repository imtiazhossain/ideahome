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
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { IconGrip } from "./IconGrip";
import { IconTrash } from "./IconTrash";
import { UiCheckbox } from "./UiCheckbox";

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
  renderItemActions?: (
    item: CheckableListItem,
    index: number
  ) => React.ReactNode;
  renderItemDetails?: (
    item: CheckableListItem,
    index: number
  ) => React.ReactNode;
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
  renderItemActions?: (
    item: CheckableListItem,
    index: number
  ) => React.ReactNode;
  renderItemDetails?: (
    item: CheckableListItem,
    index: number
  ) => React.ReactNode;
}

const DELETE_BUTTON_WIDTH = 80;
const SWIPE_THRESHOLD = 40;
const SWIPE_START_THRESHOLD = 10;

function IconFlashlight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.0"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 21h18" />
      <path d="M5.5 21h4.2l-1.1-7.2H6.6z" />
      <path d="M14.3 21h4.2l-0.9-10.2h-2.4z" />
      <path d="M6.2 13.8h2.9" />
      <path d="M15 10.8h2.9" />
      <path d="M10.8 9.2h2.7l-1.2 2.6h1.8l-2.9 4.2.8-2.9H10z" />
      <path d="M7 7.1c0-1 0.7-1.8 1.6-1.9" />
      <path d="M15.8 5.8c0-1 0.7-1.8 1.6-1.9" />
      <path d="M17.2 8.6c0-1.2 0.8-2.2 1.9-2.4" />
    </svg>
  );
}

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
  renderItemActions,
  renderItemDetails,
}: SortableItemProps) {
  const disabled = isItemDisabled?.(item) ?? false;
  const itemRef = useRef<HTMLLIElement | null>(null);
  const editingInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isPointerTracking, setIsPointerTracking] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const swipeGestureActiveRef = useRef(false);
  const lastInputTapAtRef = useRef(0);

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
    (clientX: number, clientY: number, pointerType: string) => {
      if (!canSwipe) return;
      if (pointerType !== "touch") return;
      startXRef.current = clientX;
      startYRef.current = clientY;
      startOffsetRef.current = swipeOffset;
      swipeGestureActiveRef.current = false;
      setIsPointerTracking(true);
    },
    [canSwipe, swipeOffset]
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!canSwipe || !isPointerTracking) return;
      const delta = clientX - startXRef.current;
      if (!swipeGestureActiveRef.current) {
        const deltaY = clientY - startYRef.current;
        if (Math.abs(delta) < SWIPE_START_THRESHOLD) return;
        if (Math.abs(deltaY) > Math.abs(delta)) {
          setIsPointerTracking(false);
          return;
        }
        swipeGestureActiveRef.current = true;
        setIsSwiping(true);
      }
      const next = Math.min(
        0,
        Math.max(-DELETE_BUTTON_WIDTH, startOffsetRef.current + delta)
      );
      setSwipeOffset(next);
    },
    [canSwipe, isPointerTracking]
  );

  const handlePointerEnd = useCallback(() => {
    if (!isPointerTracking) return;
    setIsPointerTracking(false);
    setIsSwiping(false);
    if (!swipeGestureActiveRef.current) return;
    swipeGestureActiveRef.current = false;
    setSwipeOffset((prev) =>
      prev < -SWIPE_THRESHOLD ? -DELETE_BUTTON_WIDTH : 0
    );
  }, [isPointerTracking]);

  React.useEffect(() => {
    if (!isPointerTracking) return;
    const onMove = (e: PointerEvent) => handlePointerMove(e.clientX, e.clientY);
    const onUp = () => handlePointerEnd();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [handlePointerEnd, handlePointerMove, isPointerTracking]);

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

  React.useEffect(() => {
    if (!isEditing) return;
    const input = editingInputRef.current;
    if (!input) return;

    const doc = input.ownerDocument;
    const scroller = doc.scrollingElement;
    const startX = window.scrollX;
    const startY = window.scrollY;
    const scrollerTop = scroller?.scrollTop ?? null;

    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }

    const raf = window.requestAnimationFrame(() => {
      input.style.height = "auto";
      input.style.height = `${input.scrollHeight}px`;
      if (typeof scrollerTop === "number" && scroller) {
        scroller.scrollTop = scrollerTop;
      }
      window.scrollTo(startX, startY);
    });

    return () => window.cancelAnimationFrame(raf);
  }, [isEditing]);

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
  const trailingControl = canSwipe
    ? swipeOffset <= -SWIPE_THRESHOLD
      ? deleteHandle
      : dragHandle
    : null;

  const isSwipeActive = canSwipe && (isSwiping || swipeOffset < 0);
  const actionSlot =
    !isEditing && !isSwipeActive ? renderItemActions?.(item, index) : null;
  const rowActions =
    actionSlot || trailingControl ? (
      <div className="features-list-row-actions">
        {actionSlot}
        {trailingControl}
      </div>
    ) : null;
  const detailsSlot = !isEditing ? renderItemDetails?.(item, index) : null;
  const selectAllEditingText = (
    e:
      | React.SyntheticEvent<HTMLTextAreaElement>
      | React.MouseEvent<HTMLTextAreaElement>
  ) => {
    const input = e.currentTarget;
    input.setSelectionRange(0, input.value.length);
  };

  const mainContent = (
    <div className="features-list-item-body">
      <div
        className="features-list-item-main"
        onClick={(e) => {
          if (disabled || isEditing) return;
          const target = e.target as HTMLElement | null;
          if (!target) return;
          if (
            target.closest(
              "button, input, textarea, a, [contenteditable='true'], [role='button']"
            )
          ) {
            return;
          }
          if (
            target.closest(
              ".features-list-item-details, .features-list-drag-handle, .features-list-row-delete"
            )
          ) {
            return;
          }
          onStartEdit(index);
        }}
      >
        {isEditing ? (
          <>
            <UiCheckbox
              className="features-list-done-toggle"
              checked={item.done}
              onChange={() => !disabled && onToggleDone(index)}
              disabled={disabled}
              aria-label={
                item.done
                  ? `Mark "${item.name}" not done`
                  : `Mark "${item.name}" done`
              }
              title={item.done ? "Mark not done" : "Mark done"}
            />
            <span className="features-list-input-wrap">
              <textarea
                ref={editingInputRef}
                value={editingValue}
                onChange={(e) => onEditingValueChange(e.target.value)}
                onBlur={onSaveEdit}
                onDoubleClick={selectAllEditingText}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
                onPointerUp={(e) => {
                  if (e.pointerType !== "touch") return;
                  const now = Date.now();
                  if (now - lastInputTapAtRef.current < 320) {
                    selectAllEditingText(
                      e as unknown as React.SyntheticEvent<HTMLTextAreaElement>
                    );
                  }
                  lastInputTapAtRef.current = now;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    onSaveEdit();
                  }
                  if (e.key === "Escape") onCancelEdit();
                }}
                className="features-list-input"
                aria-label={`Edit ${itemLabel}`}
                rows={1}
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
            <UiCheckbox
              className="features-list-done-toggle"
              checked={item.done}
              onChange={() => !disabled && onToggleDone(index)}
              disabled={disabled}
              aria-label={
                item.done
                  ? `Mark "${item.name}" not done`
                  : `Mark "${item.name}" done`
              }
              title={item.done ? "Mark not done" : "Mark done"}
            />
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
            {rowActions}
          </>
        )}
      </div>
      {detailsSlot && (
        <div className="features-list-item-details">{detailsSlot}</div>
      )}
    </div>
  );

  return (
    <li
      ref={setRefs}
      data-item-id={item.id}
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
            onPointerDown={(e) =>
              handlePointerStart(e.clientX, e.clientY, e.pointerType)
            }
          >
            {mainContent}
          </div>
        </div>
      ) : (
        mainContent
      )}
    </li>
  );
}

export function CheckableList({
  items,
  itemLabel,
  emptyMessage = "It's dark in here...\nTurn the lights on by adding something.",
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
  renderItemActions,
  renderItemDetails,
}: CheckableListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const getSelectedItems = useCallback((): CheckableListItem[] => {
    if (typeof window === "undefined") return items;
    const listNode = listRef.current;
    if (!listNode) return items;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return items;
    }
    const range = selection.getRangeAt(0);
    const selected: CheckableListItem[] = [];
    items.forEach((item) => {
      const row = listNode.querySelector<HTMLElement>(
        `li[data-item-id="${item.id}"]`
      );
      if (!row) return;
      if (range.intersectsNode(row)) selected.push(item);
    });
    return selected.length > 0 ? selected : items;
  }, [items]);

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

  const handleListCopyCapture = useCallback(
    (e: React.ClipboardEvent<HTMLUListElement>) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (typeof window === "undefined") return;
      const listNode = listRef.current;
      const selection = window.getSelection();
      if (!listNode || !selection) return;
      const anchorInside =
        selection.anchorNode && listNode.contains(selection.anchorNode);
      const focusInside =
        selection.focusNode && listNode.contains(selection.focusNode);
      if (!anchorInside && !focusInside) return;
      const selectedItems = getSelectedItems();
      if (selectedItems.length === 0) return;
      const bulletText = selectedItems.map((item) => `- ${item.name}`).join("\n");
      e.preventDefault();
      e.clipboardData.setData("text/plain", bulletText);
    },
    [getSelectedItems]
  );

  if (loading) {
    return (
      <ul
        ref={listRef}
        className="features-list"
        style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}
      >
        <li className="features-list-item features-list-item--loading">
          <div className="features-list-item-body">
            <div className="features-list-item-main">
              <span
                className="features-list-done-toggle features-list-done-toggle--placeholder"
                aria-hidden
              />
              <span className="features-list-label features-list-label--placeholder">
                Loading…
              </span>
              <div className="features-list-row-actions">
                <span
                  className="idea-plan-generate-btn idea-plan-generate-btn--loading-spinner"
                  aria-label="Loading"
                >
                  <span
                    className="bulby-thinking-spinner bulby-thinking-spinner--btn"
                    aria-hidden
                  />
                </span>
              </div>
            </div>
          </div>
        </li>
      </ul>
    );
  }
  if (items.length === 0) {
    const [firstLine, ...restLines] = emptyMessage.split("\n");
    const secondLine = restLines.join("\n");
    return (
      <div className="features-list-empty-state">
        <p className="features-list-empty-message">
          <span className="features-list-empty-line">{firstLine}</span>
          <span className="features-list-empty-icon" aria-hidden>
            <IconFlashlight />
          </span>
          {secondLine ? (
            <span className="features-list-empty-line">{secondLine}</span>
          ) : null}
        </p>
      </div>
    );
  }

  const itemIds = items.map((i) => i.id);

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToWindowEdges]}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <ul
          ref={listRef}
          className="features-list"
          style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}
          onClickCapture={handleListClickCapture}
          onCopyCapture={handleListCopyCapture}
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
              renderItemActions={renderItemActions}
              renderItemDetails={renderItemDetails}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
