const test = require("node:test");
const assert = require("node:assert/strict");
const { buildShareablePromptCoachTemplate } = require("../dist/index.js");

test("Prompt Coach template covers the current prompt efficiency workflow", () => {
  const template = buildShareablePromptCoachTemplate();

  assert.match(
    template,
    /overall score out of 100 and a score breakdown for brevity, output efficiency, redundancy control, and instruction density/i
  );
  assert.match(
    template,
    /missing prompt structure across the set: task clarity, constraints, output format, and success criteria/i
  );
  assert.match(
    template,
    /human-provided details or placeholders before optimization can be complete/i
  );
});
