# Web Text System

## Rule

Use `web/components/Text.tsx` for all new headings, labels, helper copy, and inline status text.

Do not add one-off text styling when a supported `Text` variant/tone already fits.

## Variants

- `display`: large page/hero headings
- `title`: section and modal titles
- `label`: form labels and field section names
- `body`: standard body text (default)
- `caption`: helper, metadata, and secondary inline text

## Tones

- `default`
- `muted`
- `accent`
- `danger`

## Weights

- `regular`
- `medium`
- `semibold`
- `bold`

## Example

```tsx
import { Text } from "../components/Text";

<Text as="h2" variant="title">Quality Score Configuration</Text>
<Text as="label" variant="label" tone="accent" htmlFor="title">Title</Text>
<Text as="span" variant="caption" tone="muted">Last updated 2m ago</Text>
```

## Notes

- The typography tokens/classes are defined in `web/styles/globals.css` with the `.ui-text` family.
- Legacy raw tags can remain until touched by feature work.
