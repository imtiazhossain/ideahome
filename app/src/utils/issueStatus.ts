import { ISSUE_STATUSES } from "../api/client";

export function previousStatus(current: string): string {
  const index = ISSUE_STATUSES.findIndex((s) => s === current);
  if (index <= 0) return ISSUE_STATUSES[0];
  return ISSUE_STATUSES[index - 1];
}

export function forwardStatus(current: string): string {
  const index = ISSUE_STATUSES.findIndex((s) => s === current);
  if (index < 0) return ISSUE_STATUSES[0];
  if (index >= ISSUE_STATUSES.length - 1) return ISSUE_STATUSES[ISSUE_STATUSES.length - 1];
  return ISSUE_STATUSES[index + 1];
}

export function statusLabel(status: string): string {
  return status.replace("_", " ");
}
