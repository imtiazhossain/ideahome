import { projectNameToAcronym } from "@ideahome/shared";
import type { Issue } from "../../lib/api";

export function issueKey(issue: Issue): string {
  if (issue.key) return issue.key;
  const acronym = projectNameToAcronym(issue.project?.name ?? "");
  const num = issue.id.slice(-4).toUpperCase();
  return `${acronym}-${num}`;
}
