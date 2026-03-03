import React, { forwardRef } from "react";
import { IconChevronDown } from "./icons/IconChevronDown";

export interface ExpenseCategoryDropdownProps {
  value: string;
  onChange: (category: string) => void;
  categories: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: "form" | "inline";
  listboxId: string;
  triggerAriaLabel: string;
  triggerId?: string;
  title?: string;
}

export const ExpenseCategoryDropdown = forwardRef<
  HTMLDivElement,
  ExpenseCategoryDropdownProps
>(function ExpenseCategoryDropdown(
  {
    value,
    onChange,
    categories,
    open,
    onOpenChange,
    variant,
    listboxId,
    triggerAriaLabel,
    triggerId,
    title,
  },
  ref
) {
  const isInline = variant === "inline";

  const handleSelect = (c: string) => {
    onChange(c);
    onOpenChange(false);
  };

  return (
    <div
      ref={ref}
      className={
        "expenses-category-dropdown" +
        (isInline ? " expenses-category-dropdown-inline" : "")
      }
    >
      {isInline ? (
        <button
          type="button"
          className="expenses-category-btn"
          onClick={() => onOpenChange(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={triggerAriaLabel}
          title={title ?? "Click to edit category"}
        >
          {value}
        </button>
      ) : (
        <button
          type="button"
          id={triggerId}
          className="expenses-input expenses-category-trigger"
          onClick={() => onOpenChange(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={triggerAriaLabel}
        >
          <span className="expenses-category-trigger-value">{value}</span>
          <span
            className={
              "expenses-category-trigger-chevron" + (open ? " is-open" : "")
            }
            aria-hidden
          >
            <IconChevronDown />
          </span>
        </button>
      )}
      {open && (
        <ul
          className="expenses-category-dropdown-list"
          role="listbox"
          aria-label="Category"
          id={listboxId}
        >
          {[...categories]
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
            .map((c) => (
            <li
              key={c}
              role="option"
              aria-selected={value === c}
              className={
                "expenses-category-dropdown-option" +
                (value === c ? " is-selected" : "")
              }
              onClick={() => handleSelect(c)}
            >
              <span className="expenses-category-dropdown-option-text">
                {c}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
