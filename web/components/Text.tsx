import React from "react";

type TextVariant = "display" | "title" | "label" | "body" | "caption";
type TextTone = "default" | "muted" | "accent" | "danger";
type TextWeight = "regular" | "medium" | "semibold" | "bold";

type TextProps<T extends React.ElementType> = {
  as?: T;
  variant?: TextVariant;
  tone?: TextTone;
  weight?: TextWeight;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Design-system typography primitive for headings, labels, and body text.
 */
export function Text<T extends React.ElementType = "span">({
  as,
  variant = "body",
  tone = "default",
  weight,
  className,
  children,
  ...props
}: TextProps<T>) {
  const Component = as ?? "span";
  return (
    <Component
      className={cx(
        "ui-text",
        `ui-text--${variant}`,
        `ui-text--tone-${tone}`,
        weight ? `ui-text--weight-${weight}` : undefined,
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
