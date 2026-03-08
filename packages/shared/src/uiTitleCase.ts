const LOWERCASE_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "vs",
  "via",
]);

function preserveSegment(segment: string): boolean {
  return /[A-Z].*[A-Z]/.test(segment) || /^[A-Z0-9]+$/.test(segment);
}

function formatSegment(segment: string, forceCapitalize: boolean): string {
  if (!segment) return segment;
  if (preserveSegment(segment)) return segment;

  const lower = segment.toLowerCase();
  if (!forceCapitalize && LOWERCASE_WORDS.has(lower)) {
    return lower;
  }

  const firstAlphaIndex = lower.search(/[a-z]/);
  if (firstAlphaIndex === -1) return lower;

  return (
    lower.slice(0, firstAlphaIndex) +
    lower.charAt(firstAlphaIndex).toUpperCase() +
    lower.slice(firstAlphaIndex + 1)
  );
}

function formatToken(token: string, isFirstToken: boolean): string {
  const parts = token.split("-");
  return parts
    .map((part, index) => formatSegment(part, isFirstToken || index > 0))
    .join("-");
}

export function toUiTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((token, index) => formatToken(token, index === 0))
    .join(" ");
}
