import path from "path";
import fs from "fs";

export function getMonorepoRoot(): string {
  const cwd = process.cwd();
  const here = path.join(cwd, "package.json");
  if (fs.existsSync(here)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(here, "utf-8")) as {
        workspaces?: unknown;
      };
      if (pkg.workspaces) return cwd;
    } catch {
      // ignore
    }
  }
  return path.resolve(cwd, "..");
}
