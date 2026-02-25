import React from "react";

/** Hash a string to a number for deterministic color. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Hue from name (0–360); keep saturation/lightness for readability. */
function colorFromName(name: string): string {
  const h = hashString(name) % 360;
  return `hsl(${h}, 55%, 42%)`;
}

/** First 1–2 character initials, uppercase. */
function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase().slice(0, 2);
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/** Icon for "Enhancements" list: sparkles to suggest improvements. */
const IconEnhancements = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z" />
    <path d="M5 7l.5 1.5L7 9l-1.5.5L5 11l-.5-1.5L3 9l1.5-.5L5 7z" />
  </svg>
);

const KNOWN_NAME_ICONS: { match: string | RegExp; Icon: React.FC }[] = [
  { match: /^enhancements$/i, Icon: IconEnhancements },
];

export function IconFromName({ name }: { name: string }) {
  const known = KNOWN_NAME_ICONS.find(({ match }) =>
    typeof match === "string"
      ? name.trim().toLowerCase() === match.toLowerCase()
      : match.test(name.trim())
  );
  if (known) {
    const { Icon } = known;
    return (
      <span className="icon-from-name icon-from-name--svg" aria-hidden title={name}>
        <Icon />
      </span>
    );
  }
  const bg = colorFromName(name);
  const initial = initials(name);
  return (
    <span
      className="icon-from-name"
      style={{ background: bg }}
      aria-hidden
      title={name}
    >
      {initial}
    </span>
  );
}
