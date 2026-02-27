import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function parseValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadEnvFromFileSystem(): void {
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  if (nodeEnv === "production" && process.env.ALLOW_FILE_ENV_IN_PROD !== "true") {
    return;
  }
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "backend/.env"),
    resolve(__dirname, "../../.env"),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) return;

  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;
    const value = parseValue(trimmed.slice(idx + 1));
    process.env[key] = value;
  }
}
