import React, { forwardRef } from "react";
import { IconChevronDown } from "./icons/IconChevronDown";

export type UiMenuDropdownItem = {
  id: string;
  label: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export type UiMenuDropdownGroup = {
  id: string;
  label?: string;
  items: UiMenuDropdownItem[];
};

export type UiMenuDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerText: string;
  triggerAriaLabel: string;
  groups: UiMenuDropdownGroup[];
  disabled?: boolean;
  closeOnSelect?: boolean;
  multiSelect?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
};

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Shared menu-style dropdown using the Finances trigger + list option design language.
 */
export const UiMenuDropdown = forwardRef<HTMLDivElement, UiMenuDropdownProps>(
  function UiMenuDropdown(
    {
      open,
      onOpenChange,
      triggerText,
      triggerAriaLabel,
      groups,
      disabled = false,
      closeOnSelect = true,
      multiSelect = false,
      className,
      triggerClassName,
      menuClassName,
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cx("expenses-date-filter-dropdown ui-menu-dropdown", className)}
      >
        <button
          type="button"
          className={cx(
            "expenses-input expenses-date-filter-trigger ui-menu-dropdown-trigger",
            triggerClassName
          )}
          onClick={() => {
            if (disabled) return;
            onOpenChange(!open);
          }}
          aria-label={triggerAriaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
        >
          <span className="expenses-date-filter-trigger-value">{triggerText}</span>
          <span
            className={cx(
              "expenses-category-trigger-chevron ui-menu-dropdown-chevron",
              open && "is-open"
            )}
            aria-hidden
          >
            <IconChevronDown />
          </span>
        </button>
        {open ? (
          <div
            className={cx(
              "expenses-category-dropdown-list ui-menu-dropdown-menu",
              menuClassName
            )}
            role="listbox"
            aria-multiselectable={multiSelect ? true : undefined}
          >
            {groups.map((group) => (
              <div className="ui-menu-dropdown-group" key={group.id}>
                {group.label ? (
                  <div className="ui-menu-dropdown-group-label">{group.label}</div>
                ) : null}
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cx(
                      "expenses-category-dropdown-option ui-menu-dropdown-option",
                      item.selected && "is-selected"
                    )}
                    role="option"
                    aria-selected={item.selected ? true : false}
                    disabled={item.disabled}
                    onClick={() => {
                      item.onSelect();
                      if (closeOnSelect) onOpenChange(false);
                    }}
                  >
                    {multiSelect ? (
                      <span className="ui-menu-dropdown-check" aria-hidden>
                        {item.selected ? "✓" : ""}
                      </span>
                    ) : null}
                    <span className="expenses-category-dropdown-option-text">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
);
