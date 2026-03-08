const test = require("node:test");
const assert = require("node:assert/strict");
const { toUiTitleCase } = require("../dist/index.js");

test("formats standard title case for built-in UI copy", () => {
  assert.equal(toUiTitleCase("appearance settings"), "Appearance Settings");
  assert.equal(
    toUiTitleCase("open vs completed by area"),
    "Open vs Completed by Area"
  );
  assert.equal(toUiTitleCase("7-day movement"), "7-Day Movement");
  assert.equal(
    toUiTitleCase("how to reduce tokens next time"),
    "How to Reduce Tokens Next Time"
  );
});

test("preserves acronyms and branded casing", () => {
  assert.equal(toUiTitleCase("API tests"), "API Tests");
  assert.equal(toUiTitleCase("AI model"), "AI Model");
  assert.equal(toUiTitleCase("Bulby / OpenRouter"), "Bulby / OpenRouter");
  assert.equal(toUiTitleCase("to-do list"), "To-Do List");
});
