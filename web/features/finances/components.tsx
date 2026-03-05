import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { usePlaidLink } from "react-plaid-link";
import type {
  PlaidLinkError,
  PlaidLinkOnEventMetadata,
  PlaidLinkOnExitMetadata,
} from "react-plaid-link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** Mount only when token exists; opens link once ready. */
export function PlaidLinkLauncher({
  token,
  onSuccess,
  onExit,
  onEvent,
  onOpened,
}: {
  token: string;
  onSuccess: (publicToken: string) => void;
  onExit: (
    error: PlaidLinkError | null,
    metadata: PlaidLinkOnExitMetadata
  ) => void;
  onEvent: (eventName: string, metadata: PlaidLinkOnEventMetadata) => void;
  onOpened: () => void;
}) {
  const receivedRedirectUri = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const current = new URL(window.location.href);
      return current.searchParams.has("oauth_state_id")
        ? window.location.href
        : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
    onExit,
    onEvent,
    receivedRedirectUri,
  });

  const openedRef = useRef(false);
  useEffect(() => {
    if (ready && !openedRef.current) {
      openedRef.current = true;
      open();
      onOpened();
    }
  }, [ready, open, onOpened]);

  return null;
}

export function SortableFinancesSection({
  sectionId,
  children,
}: {
  sectionId: string;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({ id: sectionId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`finances-sortable-section${isDragging ? " is-dragging" : ""}`}
    >
      {children(
        <button
          type="button"
          className="finances-section-drag-handle"
          aria-label="Drag to reorder section"
          title="Drag to reorder section"
          {...attributes}
          {...listeners}
        >
          <span className="finances-section-drag-handle-dot" />
          <span className="finances-section-drag-handle-dot" />
          <span className="finances-section-drag-handle-dot" />
        </button>
      )}
    </div>
  );
}
