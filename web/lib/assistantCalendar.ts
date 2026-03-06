import type { CalendarEvent } from "./api";

export type CalendarDayQuery = {
  label: string;
  dayStart: Date;
  dayEnd: Date;
};

export type CalendarEventLookupQuery = {
  label: string;
  searchText: string;
  timing: "any" | "next" | "last";
};

export type CalendarCreateIntent = {
  title: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  timeZone: string | null;
};

export type CalendarCreateRequest = {
  title: string;
};

export type CalendarEditIntent = {
  searchText: string;
  newTitle: string;
  dayQuery: CalendarDayQuery | null;
};

export type CalendarDeleteIntent = {
  searchText: string;
  dayQuery: CalendarDayQuery | null;
};

const MONTH_INDEX_BY_NAME: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const CALENDAR_EVENT_KEYWORDS =
  /\b(calendar|events?|schedule|appointment|meeting|hearing|deadline|reservation|booking|interview|court(?:\s+date)?|trial|arraignment|exam|checkup|visit|flight|trip)\b/;

const LOOKUP_PREFIXES = [
  /^(?:when(?:'s| is)|what time is|what day is)\s+(?:my|the|our)\s+(.+?)[?!.]*$/i,
  /^(?:do|did)\s+i\s+have\s+(?:a|an|my|the)?\s+(.+?)[?!.]*$/i,
  /^(?:is|was)\s+(?:my|the)\s+(.+?)\s+(?:today|tomorrow|yesterday|this week|next week)[?!.]*$/i,
];

function hasCalendarSignal(normalized: string): boolean {
  return CALENDAR_EVENT_KEYWORDS.test(normalized);
}

function hasCalendarMutationSignal(normalized: string): boolean {
  return /\b(add|create|schedule|put|edit|rename|change|update|delete|remove|cancel)\b/.test(
    normalized
  );
}

function normalizeLookupLabel(value: string): string {
  return value
    .replace(/\b(?:on|in)\s+my\s+calendar\b/gi, "")
    .replace(/\bplease\b/gi, "")
    .replace(/\b(?:next|upcoming|last|previous|recent)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLookupTiming(value: string): CalendarEventLookupQuery["timing"] {
  if (/\b(next|upcoming)\b/i.test(value)) return "next";
  if (/\b(last|previous|recent)\b/i.test(value)) return "last";
  return "any";
}

function tokenizeForMatch(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .filter(
      (token) =>
        ![
          "the",
          "and",
          "for",
          "with",
          "from",
          "your",
          "have",
          "there",
          "this",
          "that",
          "what",
          "when",
          "time",
          "date",
          "today",
          "tomorrow",
          "yesterday",
          "week",
          "next",
          "was",
          "did",
          "are",
          "our",
          "my",
          "calendar",
        ].includes(token)
    );
}

function buildDayBounds(date: Date): { dayStart: Date; dayEnd: Date } {
  return {
    dayStart: new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0
    ),
    dayEnd: new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      23,
      59,
      59,
      999
    ),
  };
}

function areSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMonthLabel(monthIndex: number, year: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1));
}

function parseMonthDayYearParts(
  rawMonthName: string,
  rawDay: string,
  rawYear: string | undefined,
  now: Date
): { date: Date; monthIndex: number; year: number; day: number } | null {
  const monthIndex = MONTH_INDEX_BY_NAME[rawMonthName];
  const day = Number(rawDay);
  const year = rawYear ? Number(rawYear) : now.getFullYear();
  if (monthIndex == null || Number.isNaN(day) || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(year, monthIndex, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }
  return { date, monthIndex, year, day };
}

function removeMatchedSegment(text: string, match: RegExpExecArray): string {
  const start = match.index ?? text.indexOf(match[0]);
  if (start < 0) return text;
  const end = start + match[0].length;
  return `${text.slice(0, start)} ${text.slice(end)}`;
}

function cleanupCreateTitle(value: string): string {
  return value
    .replace(/^(?:the\s+event|event)\s+/i, "")
    .replace(/\b(?:for|on|at)\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s"'`]+|[\s"'`]+$/g, "")
    .replace(/[.,!?;:]+$/g, "")
    .trim();
}

function parseCreateCalendarBody(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const patterns = [
    /^(?:can you\s+|could you\s+|would you\s+|please\s+|i want to\s+|i(?:'d| would) like to\s+|help me\s+)?(?:add|create|schedule|put)\s+(.+?)\s+(?:to|on|in)(?:\s+my)?\s+calendar(?:\s+(.+?))?[.!?]*$/i,
    /^(?:can you\s+|could you\s+|would you\s+|please\s+)?(?:add|create|schedule)\s+(.+?)\s+(?:for|into)\s+(?:my\s+)?calendar(?:\s+(.+?))?[.!?]*$/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    const body = [match?.[1], match?.[2]].filter(Boolean).join(" ").trim();
    if (body) return body;
  }
  return null;
}

function buildCalendarCreateIntentFromBody(
  body: string,
  fallbackTitle?: string
): CalendarCreateIntent | null {
  const now = new Date();
  const allDayMatch = /\b(all day)\b/i.exec(body);
  const withoutAllDay = allDayMatch ? removeMatchedSegment(body, allDayMatch) : body;
  const parsedDate = tryParseExplicitDate(withoutAllDay, now);
  const hasExplicitDate = Boolean(parsedDate);
  const date = parsedDate?.date ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const afterDate = parsedDate?.remainder ?? withoutAllDay;
  const parsedTime = tryParseExplicitTime(afterDate);
  const shouldCreateAllDay = Boolean(allDayMatch) || (hasExplicitDate && !parsedTime);

  if (!shouldCreateAllDay && !parsedTime) {
    return null;
  }

  const inlineTitle = cleanupCreateTitle(parsedTime?.remainder ?? afterDate);
  const title = inlineTitle || cleanupCreateTitle(fallbackTitle ?? "");
  if (!title) return null;

  let startAt = shouldCreateAllDay
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
    : new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        parsedTime!.hours,
        parsedTime!.minutes,
        0,
        0
      );
  if (!shouldCreateAllDay && !hasExplicitDate && startAt.getTime() <= now.getTime()) {
    startAt = new Date(
      startAt.getFullYear(),
      startAt.getMonth(),
      startAt.getDate() + 1,
      startAt.getHours(),
      startAt.getMinutes(),
      0,
      0
    );
  }
  const endAt = shouldCreateAllDay
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
    : new Date(startAt.getTime() + 60 * 60 * 1000);

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    isAllDay: shouldCreateAllDay,
    timeZone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || null
        : null,
  };
}

function tryParseExplicitDate(
  text: string,
  now: Date
): { date: Date; remainder: string } | null {
  const relativeMatch =
    /\b(today|tomorrow|yesterday)\b/i.exec(text);
  if (relativeMatch) {
    const day = relativeMatch[1].toLowerCase();
    const offset = day === "tomorrow" ? 1 : day === "yesterday" ? -1 : 0;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return {
      date,
      remainder: removeMatchedSegment(text, relativeMatch),
    };
  }

  const namedMatch =
    /\b(?:on\s+)?(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/i.exec(
      text
    );
  if (namedMatch) {
    const parsed = parseMonthDayYearParts(
      namedMatch[1],
      namedMatch[2],
      namedMatch[3],
      now
    );
    if (!parsed) return null;
    return {
      date: parsed.date,
      remainder: removeMatchedSegment(text, namedMatch),
    };
  }

  const numericMatch = /\b(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(text);
  if (!numericMatch) return null;
  const month = Number(numericMatch[1]);
  const day = Number(numericMatch[2]);
  let year = numericMatch[3] ? Number(numericMatch[3]) : now.getFullYear();
  if (year < 100) year += 2000;
  if (
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return {
    date,
    remainder: removeMatchedSegment(text, numericMatch),
  };
}

function tryParseExplicitTime(
  text: string
): { hours: number; minutes: number; remainder: string } | null {
  const timeMatch =
    /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?\b/i.exec(text) ??
    /\b(\d{1,2})(?::(\d{2}))\s*(a\.?\s*m\.?|p\.?\s*m\.?)\b/i.exec(text);
  if (!timeMatch) return null;

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2] ?? "0");
  const meridiem = (timeMatch[3] ?? "").toLowerCase().replace(/\s|\./g, "");
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "pm" && hours !== 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }

  return {
    hours,
    minutes,
    remainder: removeMatchedSegment(text, timeMatch),
  };
}

function buildQueryFromDate(date: Date, label: string): CalendarDayQuery {
  const { dayStart, dayEnd } = buildDayBounds(date);
  return { label, dayStart, dayEnd };
}

function buildWeekBounds(date: Date): { dayStart: Date; dayEnd: Date } {
  const weekday = date.getDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + diffToMonday,
    0,
    0,
    0,
    0
  );
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 6,
    23,
    59,
    59,
    999
  );
  return { dayStart: start, dayEnd: end };
}

function buildMonthBounds(year: number, monthIndex: number): {
  dayStart: Date;
  dayEnd: Date;
} {
  return {
    dayStart: new Date(year, monthIndex, 1, 0, 0, 0, 0),
    dayEnd: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
  };
}

function parseNamedMonthDate(normalized: string, now: Date): CalendarDayQuery | null {
  const match =
    /\b(?:on|for)?\s*(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/.exec(
      normalized
    );
  if (!match) return null;

  const parsed = parseMonthDayYearParts(match[1], match[2], match[3], now);
  if (!parsed) return null;
  return buildQueryFromDate(parsed.date, formatLongDate(parsed.date));
}

function parseNamedMonthRange(normalized: string, now: Date): CalendarDayQuery | null {
  const match =
    /\b(?:in|for)\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)(?:\s+(\d{4}))?\b/.exec(
      normalized
    );
  if (!match) return null;
  const monthIndex = MONTH_INDEX_BY_NAME[match[1]];
  const year = match[2] ? Number(match[2]) : now.getFullYear();
  if (monthIndex == null || Number.isNaN(year)) return null;
  const { dayStart, dayEnd } = buildMonthBounds(year, monthIndex);
  return {
    label: formatMonthLabel(monthIndex, year),
    dayStart,
    dayEnd,
  };
}

function parseBetweenDates(normalized: string, now: Date): CalendarDayQuery | null {
  const match =
    /\bbetween\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\s+and\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/.exec(
      normalized
    );
  if (!match) return null;

  const startParsed = parseMonthDayYearParts(match[1], match[2], match[3], now);
  const endParsed = parseMonthDayYearParts(
    match[4],
    match[5],
    match[6] ?? match[3],
    now
  );
  if (!startParsed || !endParsed) return null;

  const start = buildDayBounds(startParsed.date).dayStart;
  const end = buildDayBounds(endParsed.date).dayEnd;
  if (start.getTime() > end.getTime()) return null;

  return {
    label: `${formatLongDate(start)} to ${formatLongDate(end)}`,
    dayStart: start,
    dayEnd: end,
  };
}

export function isCalendarQuestion(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return hasCalendarSignal(normalized);
}

export function isCalendarMutationRequest(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return hasCalendarSignal(normalized) && hasCalendarMutationSignal(normalized);
}

export function tryParseCalendarDayQuery(text: string): CalendarDayQuery | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  if (!hasCalendarSignal(normalized)) return null;
  const now = new Date();
  if (/\byesterday\b/.test(normalized)) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return buildQueryFromDate(date, "yesterday");
  }
  if (/\btomorrow\b/.test(normalized)) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return buildQueryFromDate(date, "tomorrow");
  }
  if (/\btoday\b/.test(normalized)) {
    return buildQueryFromDate(now, "today");
  }
  if (/\bthis week\b/.test(normalized)) {
    const { dayStart, dayEnd } = buildWeekBounds(now);
    return { label: "this week", dayStart, dayEnd };
  }
  if (/\bnext week\b/.test(normalized)) {
    const nextWeekAnchor = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 7
    );
    const { dayStart, dayEnd } = buildWeekBounds(nextWeekAnchor);
    return { label: "next week", dayStart, dayEnd };
  }
  return (
    parseBetweenDates(normalized, now) ??
    parseNamedMonthRange(normalized, now) ??
    parseNamedMonthDate(normalized, now)
  );
}

export function tryParseCalendarEventLookupQuery(
  text: string
): CalendarEventLookupQuery | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const pattern of LOOKUP_PREFIXES) {
    const match = pattern.exec(trimmed);
    const label = normalizeLookupLabel(match?.[1] ?? "");
    const timing = parseLookupTiming(match?.[1] ?? "");
    if (!label) continue;
    const tokens = tokenizeForMatch(label);
    if (tokens.length === 0) continue;
    if (!hasCalendarSignal(label.toLowerCase()) && tokens.length < 2) continue;
    return {
      label,
      searchText: tokens.join(" "),
      timing,
    };
  }

  return null;
}

export function tryParseCalendarCreateIntent(
  text: string
): CalendarCreateIntent | null {
  const body = parseCreateCalendarBody(text);
  if (!body) return null;
  return buildCalendarCreateIntentFromBody(body);
}

export function tryParseCalendarCreateRequest(
  text: string
): CalendarCreateRequest | null {
  const body = parseCreateCalendarBody(text);
  if (!body) return null;
  const title = cleanupCreateTitle(body);
  if (!title) return null;
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
  };
}

export function tryParseCalendarCreateFollowUp(
  text: string,
  pendingTitle: string
): CalendarCreateIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return buildCalendarCreateIntentFromBody(trimmed, pendingTitle);
}

export function tryParseCalendarEditIntent(
  text: string
): CalendarEditIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match =
    /^(?:can you\s+|could you\s+|would you\s+|please\s+)?(?:edit|rename|change|update)\s+(?:the\s+)?(.+?)\s+event(?:\s+(for\s+(?:today|tomorrow|yesterday|this week|next week)))?\s+to\s+(.+?)[.!?]*$/i.exec(
      trimmed
    );
  if (!match) return null;

  const searchLabel = cleanupCreateTitle(match[1] ?? "");
  const newTitle = cleanupCreateTitle(match[3] ?? "");
  if (!searchLabel || !newTitle) return null;
  if (searchLabel.toLowerCase() === newTitle.toLowerCase()) return null;

  const dayQuery = match[2] ? tryParseCalendarDayQuery(`calendar ${match[2]}`) : null;
  return {
    searchText: tokenizeForMatch(searchLabel).join(" "),
    newTitle: newTitle.charAt(0).toUpperCase() + newTitle.slice(1),
    dayQuery,
  };
}

export function tryParseCalendarDeleteIntent(
  text: string
): CalendarDeleteIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match =
    /^(?:can you\s+|could you\s+|would you\s+|please\s+)?(?:delete|remove|cancel)\s+(?:the\s+)?(.+?)(?:\s+events?)?(?:\s+(for\s+(?:today|tomorrow|yesterday|this week|next week)))?[.!?]*$/i.exec(
      trimmed
    );
  if (!match) return null;
  if (!/\b(calendar|event|events)\b/i.test(trimmed)) return null;

  const searchLabel = cleanupCreateTitle(match[1] ?? "");
  if (!searchLabel) return null;
  const searchText = tokenizeForMatch(searchLabel).join(" ");
  if (!searchText) return null;
  const dayQuery = match[2] ? tryParseCalendarDayQuery(`calendar ${match[2]}`) : null;
  return { searchText, dayQuery };
}

export function getCalendarDayRange(query: CalendarDayQuery): {
  start: string;
  end: string;
  dayStart: Date;
  dayEnd: Date;
} {
  return {
    start: query.dayStart.toISOString(),
    end: query.dayEnd.toISOString(),
    dayStart: query.dayStart,
    dayEnd: query.dayEnd,
  };
}

function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) return "All day";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.startAt));
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );
}

function formatEventDateTime(event: CalendarEvent): string {
  const startAt = new Date(event.startAt);
  const day = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(startAt);
  return `${day} ${formatEventTime(event)}`;
}

export function summarizeCalendarEventsForDay(
  events: CalendarEvent[],
  query: CalendarDayQuery,
  dayStart: Date,
  dayEnd: Date
): string {
  const filtered = sortEvents(events).filter((event) => {
    const startAt = new Date(event.startAt).getTime();
    const endAt = new Date(event.endAt).getTime();
    return startAt <= dayEnd.getTime() && endAt >= dayStart.getTime();
  });

  if (filtered.length === 0) {
    return `You currently do not have any events on your calendar for ${query.label}.`;
  }

  const isSingleDay = areSameDay(dayStart, dayEnd);
  const lines = filtered.slice(0, 6).map((event) => {
    const title = event.title.trim() || "Untitled event";
    return `- ${isSingleDay ? formatEventTime(event) : formatEventDateTime(event)}: ${title}`;
  });

  const extraCount = filtered.length - lines.length;
  if (extraCount > 0) {
    lines.push(`- ${extraCount} more event${extraCount === 1 ? "" : "s"}`);
  }

  return [`Here is what is on your calendar for ${query.label}:`, ...lines].join(
    "\n"
  );
}

export function summarizeMatchingCalendarEvents(
  events: CalendarEvent[],
  query: CalendarEventLookupQuery
): string {
  const queryTokens = tokenizeForMatch(query.searchText);
  if (queryTokens.length === 0) {
    return `I couldn't identify which calendar event you meant by "${query.label}".`;
  }

  const matches = sortEvents(events).filter((event) => {
    const haystack = `${event.title} ${event.description ?? ""} ${event.location ?? ""}`.toLowerCase();
    return queryTokens.every((token) => haystack.includes(token));
  });

  if (matches.length === 0) {
    return `I couldn't find a calendar event matching "${query.label}".`;
  }

  const now = Date.now();
  if (query.timing === "next") {
    const nextMatch = matches.find((event) => new Date(event.startAt).getTime() >= now);
    if (nextMatch) {
      const title = nextMatch.title.trim() || "Untitled event";
      return `Your next ${query.label} is on ${formatEventDateTime(nextMatch)}${title ? `: ${title}` : ""}.`;
    }
  }

  if (query.timing === "last") {
    const previousMatches = matches.filter(
      (event) => new Date(event.startAt).getTime() < now
    );
    const lastMatch = previousMatches.at(-1);
    if (lastMatch) {
      const title = lastMatch.title.trim() || "Untitled event";
      return `Your last ${query.label} was on ${formatEventDateTime(lastMatch)}${title ? `: ${title}` : ""}.`;
    }
  }

  if (matches.length === 1) {
    const [event] = matches;
    const title = event.title.trim() || "Untitled event";
    return `${title} is on ${formatEventDateTime(event)}.`;
  }

  const lines = matches.slice(0, 6).map((event) => {
    const title = event.title.trim() || "Untitled event";
    return `- ${formatEventDateTime(event)}: ${title}`;
  });
  const extraCount = matches.length - lines.length;
  if (extraCount > 0) {
    lines.push(`- ${extraCount} more matching event${extraCount === 1 ? "" : "s"}`);
  }
  return [`I found multiple calendar events matching "${query.label}":`, ...lines].join(
    "\n"
  );
}

export function getCalendarContextRange(now = new Date()): {
  start: string;
  end: string;
} {
  const start = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function formatCalendarEventsAsContext(events: CalendarEvent[]): string {
  const sorted = sortEvents(events).slice(0, 80);
  if (sorted.length === 0) {
    return "Calendar events: (none found in the synced calendar range)";
  }

  const lines = [
    "The following are the user's actual synced calendar events. Use them when answering calendar questions. Do not claim you lack calendar access if events are present.",
    "",
    "Calendar events:",
  ];

  for (const event of sorted) {
    const title = event.title.trim() || "Untitled event";
    lines.push(`- ${formatEventDateTime(event)} | ${title}`);
  }

  if (events.length > sorted.length) {
    lines.push(`- ${events.length - sorted.length} more calendar events not shown`);
  }

  return lines.join("\n");
}
