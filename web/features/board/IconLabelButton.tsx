import React from "react";

type IconLabelButtonVariant = "primary" | "secondary" | "danger";
type IconLabelButtonSize = "sm" | "md";

export type IconLabelButtonProps = {
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: IconLabelButtonVariant;
  size?: IconLabelButtonSize;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function IconLabelButton({
  icon,
  children,
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...buttonProps
}: IconLabelButtonProps) {
  const variantClass =
    variant === "primary"
      ? "expenses-add-btn"
      : variant === "danger"
        ? "btn btn-danger-outline"
        : "btn btn-secondary";

  const sizeClass = size === "sm" ? "btn-sm" : "";
  const classes = ["issue-icon-label-btn", variantClass, sizeClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...buttonProps}>
      {icon ? <span className="issue-icon-label-btn__icon">{icon}</span> : null}
      <span className="issue-icon-label-btn__label">{children}</span>
    </button>
  );
}

