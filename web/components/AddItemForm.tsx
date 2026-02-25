import React from "react";
import { IconPlus } from "./IconPlus";

export interface AddItemFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder: string;
  ariaLabel: string;
  submitAriaLabel: string;
  submitTitle: string;
  error?: string | null;
  onClearError?: () => void;
}

export function AddItemForm({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel,
  submitAriaLabel,
  submitTitle,
  error,
  onClearError,
}: AddItemFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="features-add-form"
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        alignItems: "center",
        marginTop: "8px",
      }}
    >
      {error && (
        <p
          role="alert"
          style={{
            width: "100%",
            margin: "0 0 4px",
            fontSize: 14,
            color: "var(--trend-down)",
          }}
        >
          {error}
        </p>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onClearError?.();
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="project-nav-search"
        style={{ flex: "1", minWidth: "200px", padding: "8px 12px" }}
      />
      <button
        type="submit"
        className="project-nav-add"
        aria-label={submitAriaLabel}
        title={submitTitle}
      >
        <IconPlus />
      </button>
    </form>
  );
}
