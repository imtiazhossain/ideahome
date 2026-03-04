import React from "react";

type UiCheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Design-system checkbox control for new pages.
 */
export function UiCheckbox({ className, ...props }: UiCheckboxProps) {
  return <input type="checkbox" className={cx("ui-checkbox", className)} {...props} />;
}
