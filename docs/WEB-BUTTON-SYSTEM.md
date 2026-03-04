# Web Button System

## Rule

Use `web/components/Button.tsx` for all **new page/action buttons**.

Do not introduce new ad-hoc button styles for primary interactions in pages.

## Allowed Variants

- `primary`: main action in a section/form
- `secondary`: neutral/standard action (default)
- `ghost`: low-emphasis action
- `danger`: destructive action

## Sizes

- `sm`
- `md` (default)
- `lg`

## Examples

```tsx
import { Button } from "../components/Button";

<Button variant="secondary">Connect Google Calendar</Button>
<Button variant="primary">Save changes</Button>
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="danger" size="sm">Delete</Button>
```

## Migration guidance

- Existing legacy buttons (for example `project-nav-add`, `btn btn-primary`) can remain temporarily.
- Any file touched for feature work should migrate nearby newly-added actions to `Button`.
- Avoid inline button style objects for new UI.

## Accessibility baseline

- Keep visible button text for actions.
- Use `disabled` for unavailable actions.
- Add `aria-label` only when visible text is not descriptive enough.
