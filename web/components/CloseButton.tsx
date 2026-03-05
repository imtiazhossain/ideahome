import React from "react";
import { IconX } from "./icons";

type CloseButtonSize = "sm" | "md" | "lg";

export type CloseButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: CloseButtonSize;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const ICON_SIZE_BY_BUTTON_SIZE: Record<CloseButtonSize, number> = {
  sm: 12,
  md: 16,
  lg: 18,
};

export function CloseButton({
  size = "md",
  className,
  type,
  "aria-label": ariaLabel,
  ...props
}: CloseButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cx("ui-close-btn", `ui-close-btn--${size}`, className)}
      aria-label={ariaLabel ?? "Close"}
      {...props}
    >
      <IconX size={ICON_SIZE_BY_BUTTON_SIZE[size]} />
    </button>
  );
}
