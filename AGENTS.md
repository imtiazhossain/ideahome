# AGENTS.md

## Local shorthand rule
- If the user says `push`, interpret it as: `git add -A`, create a commit (using a concise default message if one is not provided), then `git push` to the current branch's upstream.

## Git safety
- Do **not** push changes (or run `git push`) unless the user explicitly says to push.

## Deployment constraints
- Keep `web/vercel.json` `buildCommand` at or below 256 characters to satisfy Vercel schema validation.
- If the build pipeline is longer, move logic into a root `package.json` script and call that script from `web/vercel.json`.

## UI copy rule
- All built-in UI titles and headings must use standard title case: capitalize major words, keep short prepositions, articles, and conjunctions lowercase unless they are the first word.
- Never rewrite user-entered names to fit this rule.
- For generated or centralized built-in titles, use `toUiTitleCase` from `@ideahome/shared`.

## Communication tone rule
- In assistant responses for this project, keep a grounded, self-respecting tone.
- Do not frame work product with self-critical or self-diminishing language.
- Preserve rigor and directness, but communicate with calm confidence rather than harshness.
