import React from "react";
import { SectionLoadingSpinner } from "./SectionLoadingSpinner";

interface ProjectSectionGuardProps {
  projectsLoaded: boolean;
  selectedProjectId: string;
  /** Shown when loaded and no project selected (for this section). */
  message: string;
  /** "add" = show children when project selected; "list" = show children when project selected. */
  variant: "add" | "list";
  children: React.ReactNode;
}

export function ProjectSectionGuard({
  projectsLoaded,
  selectedProjectId,
  message,
  variant,
  children,
}: ProjectSectionGuardProps) {
  if (!projectsLoaded) {
    return <SectionLoadingSpinner />;
  }
  if (variant === "add") {
    if (selectedProjectId) return <>{children}</>;
    return <p className="tests-page-section-desc">{message}</p>;
  }
  if (!selectedProjectId) {
    return <p className="tests-page-section-desc">{message}</p>;
  }
  return <>{children}</>;
}
