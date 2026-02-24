const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "backend", "src", "coverage", "lcov-report");
const dest = path.join(__dirname, "..", "web", "public", "coverage-report");

// Remove keyboard-hint paragraph and Filter template from Istanbul HTML
const BLOCK_TO_REMOVE = /[\s\n]*<p class="quiet">\s*Press[\s\S]*?<\/template>\s*/;

function stripCoverageUi(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      stripCoverageUi(full);
    } else if (e.name.endsWith(".html")) {
      let content = fs.readFileSync(full, "utf-8");
      const next = content.replace(BLOCK_TO_REMOVE, "\n        ");
      if (next !== content) {
        fs.writeFileSync(full, next, "utf-8");
      }
    }
  }
}

if (!fs.existsSync(src)) {
  console.error("No coverage report found. Run: pnpm --filter backend test -- --coverage");
  process.exit(1);
}

const publicDir = path.join(__dirname, "..", "web", "public");
fs.mkdirSync(publicDir, { recursive: true });
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true });
}
fs.cpSync(src, dest, { recursive: true });
stripCoverageUi(dest);

// Append dark theme so the report is readable in the app's dark mode
const baseCssPath = path.join(dest, "base.css");
const darkThemePath = path.join(__dirname, "coverage-dark-theme.css");
if (fs.existsSync(baseCssPath) && fs.existsSync(darkThemePath)) {
  const baseCss = fs.readFileSync(baseCssPath, "utf-8");
  const darkCss = fs.readFileSync(darkThemePath, "utf-8");
  fs.writeFileSync(baseCssPath, baseCss.trimEnd() + "\n\n" + darkCss, "utf-8");
}

console.log("Coverage report copied to web/public/coverage-report");
