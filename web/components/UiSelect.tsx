import React from "react";

type UiSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Design-system select control for new pages.
 * Uses the same visual language as Finances dropdown inputs.
 */
export function UiSelect({ className, children, ...props }: UiSelectProps) {
  return (
    <select
      className={cx("ui-select", "app-select", className)}
      {...props}
    >
      {children}
    </select>
  );
}
