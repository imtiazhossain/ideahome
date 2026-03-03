export const colors = {
  bgPage: "#f5f5f7",
  bgBar: "#ffffff",
  bgCard: "#ffffff",
  columnBg: "#f9fafb",
  border: "#e5e7eb",
  borderInput: "#d1d5db",
  text: "#1f2937",
  textMuted: "#6b7280",
  accent: "#374151",
  accentStrong: "#ffffff",
  accentDark: "#1f2937",
  danger: "#b91c1c",
  cardShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
  editModeBorder: "#3b82f6",
  editModeBorderInner: "rgba(255, 255, 255, 0.7)",
  status: {
    backlog: "#6b7280",
    todo: "#3b82f6",
    in_progress: "#f59e0b",
    done: "#10b981",
  },
} as const;

export const radii = {
  card: 12,
  control: 10,
  small: 8,
} as const;

export const spacing = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
} as const;
