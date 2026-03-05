"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { CloseButton } from "./CloseButton";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface AccessibleModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional overlay class (e.g. modal-overlay--above-detail) */
  overlayClassName?: string;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function AccessibleModal({
  open,
  onClose,
  title,
  children,
  overlayClassName = "",
}: AccessibleModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open || !dialogRef.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const target = e.target as HTMLElement;
      if (e.shiftKey) {
        if (target === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (target === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    if (!open) return;
    previousActiveElement.current =
      (typeof document !== "undefined" ? document.activeElement : null) as HTMLElement | null;
    const focusable = dialogRef.current
      ? getFocusableElements(dialogRef.current)
      : [];
    const toFocus = focusable[0] ?? dialogRef.current;
    if (toFocus) {
      requestAnimationFrame(() => toFocus.focus());
    }
    return () => {
      if (previousActiveElement.current?.focus) {
        previousActiveElement.current.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={`modal-overlay ${overlayClassName}`.trim()}
      onClick={() => onClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accessible-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="accessible-modal-title">{title}</h2>
          <CloseButton className="modal-close" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
