import type { IssueComment } from "../../lib/api/issues";
import type { IssueScreenshot } from "../../lib/api/media";

export function deriveScreenshotNameFromComments(
  screenshots: IssueScreenshot[],
  comments: IssueComment[]
): Map<string, string> {
  const map = new Map<string, string>();
  const looksLikeImageFilename = (name: string) =>
    /\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(name.trim());
  for (const c of comments) {
    const re = /\[([^\]]+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(c.body)) !== null) {
      const label = m[1];
      let shot: IssueScreenshot | undefined;
      const numMatch = /^Screenshot (\d+)$/.exec(label);
      if (numMatch) {
        const idx = parseInt(numMatch[1], 10);
        if (idx >= 1 && idx <= screenshots.length) shot = screenshots[idx - 1];
      } else {
        shot = screenshots.find((s) => (s.name ?? "").trim() === label);
      }
      if (!shot) {
        const firstUnnamed = screenshots.find(
          (s) => !(s.name ?? "").trim() && !map.has(s.id)
        );
        if (firstUnnamed && looksLikeImageFilename(label)) shot = firstUnnamed;
      }
      if (shot && !map.has(shot.id)) map.set(shot.id, label);
    }
  }
  return map;
}
