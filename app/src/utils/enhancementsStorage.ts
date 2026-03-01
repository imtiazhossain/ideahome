import { readUserIdFromToken } from "./auth";

export function enhancementsStorageKey(projectId: string, token: string): string {
  const userId = readUserIdFromToken(token);
  return userId
    ? `ideahome-enhancements-${userId}-${projectId}`
    : `ideahome-enhancements-${projectId}`;
}
