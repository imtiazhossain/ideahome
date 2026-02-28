import type { Issue } from "../../lib/api/issues";

export function hasIssueDetailChanges(
  selected: Issue | null,
  original: Issue | null
): boolean {
  if (!selected || !original || selected.id !== original.id) return false;
  return (
    (selected.title ?? "") !== (original.title ?? "") ||
    (selected.description ?? "") !== (original.description ?? "") ||
    (selected.acceptanceCriteria ?? "") !==
      (original.acceptanceCriteria ?? "") ||
    (selected.database ?? "") !== (original.database ?? "") ||
    (selected.api ?? "") !== (original.api ?? "") ||
    (selected.testCases ?? "") !== (original.testCases ?? "") ||
    (selected.automatedTest ?? "") !== (original.automatedTest ?? "") ||
    (selected.assigneeId ?? "") !== (original.assigneeId ?? "")
  );
}
