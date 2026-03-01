export function parseAutomatedTestNames(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .flatMap((entry) => {
          if (typeof entry === "string") return [entry];
          if (entry && typeof entry === "object" && "name" in entry) {
            const name = (entry as { name?: unknown }).name;
            return typeof name === "string" ? [name] : [];
          }
          return [];
        })
        .map((name) => name.trim())
        .filter(Boolean);
    }
  } catch {
    // fallback below
  }
  return trimmed
    .split(/\r?\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
}
