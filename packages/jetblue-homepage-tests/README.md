# JetBlue Homepage Tests

Playwright end-to-end tests for the public [JetBlue homepage](https://www.jetblue.com).

## Run

```bash
pnpm --filter jetblue-homepage-tests test
```

First run may require browser binaries:

```bash
pnpm --filter jetblue-homepage-tests exec playwright install chromium
```
