import React from "react";

export interface ProjectSelectProps {
  projects: { id: string; name: string }[];
  value: string;
  onChange: (projectId: string) => void;
  id?: string;
  required?: boolean;
  emptyOptionLabel?: string;
  emptyHint?: string;
  className?: string;
  selectClassName?: string;
}

export function ProjectSelect({
  projects,
  value,
  onChange,
  id = "project-select",
  required = true,
  emptyOptionLabel = "Select a project",
  emptyHint = "No projects yet. Create one via the API or add seed data.",
  className,
  selectClassName = "form-select",
}: ProjectSelectProps) {
  return (
    <div className={`form-group${className ? ` ${className}` : ""}`}>
      <label htmlFor={id}>Project</label>
      <select
        id={id}
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">{emptyOptionLabel}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {projects.length === 0 && <span className="form-hint">{emptyHint}</span>}
    </div>
  );
}
