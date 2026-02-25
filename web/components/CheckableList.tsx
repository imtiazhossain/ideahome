import React, { useRef } from "react";
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

const IconGrip = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
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
  onReorder: (fromIndex: number, toIndex: number) => void;
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
}: SortableItemProps) {
  const disabled = isItemDisabled?.(item) ?? false;
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`features-list-item ${item.done ? "features-list-item--done" : ""} ${isDragging ? "features-list-item--dragging" : ""}`}
    >
      <span
        className="features-list-drag-handle"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        title="Drag to reorder"
      >
        <IconGrip />
      </span>
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
    </li>
  );
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
  onReorder,
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
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
