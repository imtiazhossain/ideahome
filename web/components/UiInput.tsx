import React from "react";

type UiInputProps = React.InputHTMLAttributes<HTMLInputElement>;

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Design-system input control for new pages.
 * Reuses the Finances input visual language.
 */
export function UiInput({ className, ...props }: UiInputProps) {
  return (
    <input
      className={cx("ui-input", "expenses-date-filter-submenu-input", className)}
      {...props}
    />
  );
}
