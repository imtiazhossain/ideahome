const DURATION_SUFFIX = /^ \(\d+(\.\d+)?(ms|s)\)$/;

/** Strip ANSI escape codes and put each step on its own line. */
export function stripAnsi(text: string): string {
  let out = text
    .replace(/\x1b\[[\d]*E/g, "\n")
    .replace(/\x1b\[[?]?[\d;]*[A-Za-z]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "")
    .replace(/\x1b[PX^_][^\x1b]*/g, "")
    .replace(/\s*\[\d*E\]\s*/g, "\n")
    .replace(/\s*\[\d+[A-Za-z]\s*/g, " ")
    .replace(/\s*\[\d+;\d*[A-Za-z]\s*/g, " ");
  out = out
    .replace(/(\))\s+(\d+\.\d+\s+)/g, "$1\n$2")
    .replace(/(\))\s+(1\s+\[)/g, "$1\n$2");
  return out
    .split("\n")
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .join("\n");
}

/** Keep only the line that shows run time when the same step appears twice (with and without duration). */
export function dedupeStepLines(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    const nextIsSameWithDuration =
      next != null &&
      next.startsWith(line) &&
      DURATION_SUFFIX.test(next.slice(line.length));
    if (nextIsSameWithDuration) continue;
    kept.push(line);
  }
  return kept.join("\n");
}

/** Remove redundant "1.N test title › " prefix from step lines so only step name and duration show. */
export function shortenStepLines(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\d+\.\d+ .+? › /, ""))
    .join("\n");
}

/** Add "✓ " before each step line (lines ending with (Nms) or (N.Ns), excluding "N passed" summary). */
export function prefixStepLinesWithDash(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (
        /\(\d+(\.\d+)?(ms|s)\)$/.test(line.trim()) &&
        !/^\d+ (passed|failed) /.test(line.trim())
      ) {
        return "✓ " + line;
      }
      return line;
    })
    .join("\n");
}

/**
 * Extract step lines from Playwright list reporter output (printSteps: true, PLAYWRIGHT_FORCE_TTY=1).
 * Step lines are indented and typically contain " › " (step path) and/or end with "(Nms)" duration.
 */
export function parseStepsFromOutput(output: string): string[] {
  const steps: string[] = [];
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip summary lines
    if (
      /^Running \d+ test/.test(trimmed) ||
      /^\d+ passed/.test(trimmed) ||
      /^\d+ failed/.test(trimmed)
    )
      continue;
    // Skip test result line (✓/× at start of line)
    if (
      /^[✓×]\s/.test(trimmed) ||
      /^ok\s/.test(trimmed) ||
      /^x\s/.test(trimmed)
    )
      continue;
    // Step lines: indented, often "N.N  title › step (duration)" or "  title › step (123ms)"
    const isIndented = /^  /.test(line);
    const looksLikeStep =
      / › .*\(\d+(\.\d+)?(ms|s)\)/.test(trimmed) ||
      (/^[\d.]+\s+/.test(trimmed) && /\(\d+(\.\d+)?(ms|s)\)/.test(trimmed));
    if (isIndented && (looksLikeStep || /^[\d.]+\s+/.test(trimmed))) {
      // Normalize: remove leading "N.N  " so we show "test › step (duration)" or step text
      const withoutIndex = trimmed.replace(/^\d+(\.\d+)?\s+/, "");
      steps.push(withoutIndex);
    }
  }
  return steps;
}
