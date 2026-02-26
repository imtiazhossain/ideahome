import React, { useEffect, useRef } from "react";

export interface AutoResizeTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className,
  rows = 1,
}: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(adjustHeight, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange(e);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.stopPropagation();
      }}
      placeholder={placeholder}
      className={className}
      rows={rows}
    />
  );
}
