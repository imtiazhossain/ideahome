import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  buildPromptUsageDetail,
  type PromptUsageDetailEntry,
  type PromptUsageTrendPoint,
} from "@ideahome/shared";
import { getMonorepoRoot } from "./monorepo-root";

type CodexPromptUsageSnapshot = {
  entries: PromptUsageDetailEntry[];
  points: PromptUsageTrendPoint[];
  importedSessions: number;
};

type SessionMetaPayload = {
  id?: string;
  cwd?: string;
};

type JsonLineRecord = {
  timestamp?: string;
  type?: string;
  payload?: Record<string, unknown>;
};

const MAX_ENTRIES = 160;

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

function shouldSkipInjectedUserMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("# AGENTS.md instructions for ")) return true;
  if (trimmed.includes("<environment_context>")) return true;
  if (trimmed.includes("<INSTRUCTIONS>")) return true;
  return false;
}

function extractTextChunks(content: unknown, kind: "input_text" | "output_text"): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((chunk) => {
      if (!chunk || typeof chunk !== "object") return "";
      const row = chunk as { type?: unknown; text?: unknown };
      if (row.type !== kind || typeof row.text !== "string") return "";
      return row.text;
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function listJsonlFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return listJsonlFiles(fullPath);
        if (entry.isFile() && entry.name.endsWith(".jsonl")) return [fullPath];
        return [];
      })
    );
    return nested.flat();
  } catch {
    return [];
  }
}

async function parseSessionFile(
  filePath: string,
  repoRoot: string
): Promise<PromptUsageDetailEntry[]> {
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  let sessionMeta: SessionMetaPayload | null = null;
  const entries: PromptUsageDetailEntry[] = [];
  let currentUserPrompt: { text: string; timestamp: string; id: string } | null =
    null;
  let assistantChunks: string[] = [];

  const flushCurrent = () => {
    if (!currentUserPrompt) return;
    const promptText = currentUserPrompt.text.trim();
    if (!promptText) {
      currentUserPrompt = null;
      assistantChunks = [];
      return;
    }
    const completionText = assistantChunks.join("\n").trim();
    const promptTokens = estimateTokens(promptText);
    const completionTokens = estimateTokens(completionText);
    entries.push(
      buildPromptUsageDetail({
        id: currentUserPrompt.id,
        timestamp: currentUserPrompt.timestamp,
        source: "codex-estimated",
        promptText,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      })
    );
    currentUserPrompt = null;
    assistantChunks = [];
  };

  for (const line of lines) {
    let record: JsonLineRecord;
    try {
      record = JSON.parse(line) as JsonLineRecord;
    } catch {
      continue;
    }

    if (record.type === "session_meta") {
      sessionMeta = (record.payload ?? {}) as SessionMetaPayload;
      continue;
    }

    if (
      sessionMeta?.cwd &&
      path.resolve(sessionMeta.cwd) !== repoRoot
    ) {
      return [];
    }

    if (record.type !== "response_item") continue;
    const payload = record.payload ?? {};
    if (payload.type !== "message") continue;
    const role = payload.role;
    if (role === "user") {
      flushCurrent();
      const text = extractTextChunks(payload.content, "input_text");
      if (!text || shouldSkipInjectedUserMessage(text)) continue;
      currentUserPrompt = {
        id: `${sessionMeta?.id ?? path.basename(filePath)}-${entries.length + 1}`,
        timestamp: record.timestamp ?? new Date().toISOString(),
        text,
      };
      continue;
    }
    if (role === "assistant" && currentUserPrompt) {
      const text = extractTextChunks(payload.content, "output_text");
      if (text) assistantChunks.push(text);
    }
  }

  flushCurrent();
  return entries;
}

export async function readCodexPromptUsage(): Promise<CodexPromptUsageSnapshot> {
  const repoRoot = getMonorepoRoot();
  const codexRoot = path.join(os.homedir(), ".codex");
  const files = [
    ...(await listJsonlFiles(path.join(codexRoot, "sessions"))),
    ...(await listJsonlFiles(path.join(codexRoot, "archived_sessions"))),
  ];
  const dedupedFiles = Array.from(new Set(files)).sort();
  const parsed = await Promise.all(
    dedupedFiles.map((filePath) => parseSessionFile(filePath, repoRoot))
  );
  const entries = Array.from(
    new Map(
      parsed
        .flat()
        .map((entry) => [entry.id, entry] as const)
    ).values()
  )
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-MAX_ENTRIES);
  const points = entries.map((entry) => ({
    timestamp: entry.timestamp,
    totalTokens: entry.totalTokens,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    promptCount: 1,
  }));
  return {
    entries,
    points,
    importedSessions: dedupedFiles.length,
  };
}
