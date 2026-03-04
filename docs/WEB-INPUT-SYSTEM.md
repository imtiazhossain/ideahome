# Web Input System

## Rule

Use design-system components for all new input controls:

- `web/components/UiInput.tsx` for text/number/date/time
- `web/components/UiCheckbox.tsx` for checkbox controls

Do not add new one-off page-level input styles for standard form controls.

## Approved Pattern

```tsx
import { UiInput } from "../components/UiInput";
import { UiCheckbox } from "../components/UiCheckbox";

<UiInput value={value} onChange={(e) => setValue(e.target.value)} />
<UiInput type="number" min={0} max={100} />
<UiInput type="datetime-local" />
<UiCheckbox checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
```

## Notes

- `UiInput` intentionally reuses Finances input styling (`expenses-date-filter-submenu-input`).
- Checkboxes are globally styled to the list/filter design-system checkbox language.
- `UiCheckbox` is still the preferred component for new checkbox fields in code.
- Use `className="ui-input--compact"` for compact numeric fields (for example small `%` inputs).
- Existing legacy inputs can remain until touched by feature work.
