# AGENTS.md

## Local shorthand rule
- If the user says `push`, interpret it as: `git add -A`, create a commit (using a concise default message if one is not provided), then `git push` to the current branch's upstream.

## Deployment constraints
- Keep `web/vercel.json` `buildCommand` at or below 256 characters to satisfy Vercel schema validation.
- If the build pipeline is longer, move logic into a root `package.json` script and call that script from `web/vercel.json`.
