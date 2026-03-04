# Web Dropdown + Calendar System

## Rule

For **all new dropdowns and date/calendar pickers**, use the Finances design language through shared components:

- `UiSelect` (`web/components/UiSelect.tsx`)
- `UiDatePickerField` (`web/components/UiDatePickerField.tsx`)
- `UiMenuDropdown` (`web/components/UiMenuDropdown.tsx`) for custom menu/listbox dropdowns
- `CalendarPickerPopup` (`web/components/CalendarPickerPopup.tsx`) for popup calendar internals

Do not create new one-off dropdown or calendar styles for page-level UI.

## Approved Patterns

### Dropdown/select

```tsx
import { UiSelect } from "../components/UiSelect";

<UiSelect value={value} onChange={...}>
  <option value="a">A</option>
</UiSelect>
```

### Date picker field

```tsx
import { UiDatePickerField } from "../components/UiDatePickerField";

<UiDatePickerField
  label="Date"
  value={selectedDate}
  onChange={setSelectedDate}
/>
```

### Menu/listbox dropdown

```tsx
import { UiMenuDropdown } from "../components/UiMenuDropdown";

<UiMenuDropdown
  open={open}
  onOpenChange={setOpen}
  triggerText="Select item"
  triggerAriaLabel="Select item"
  groups={[
    {
      id: "group-a",
      label: "Group A",
      items: [{ id: "a1", label: "Option A1", onSelect: () => {} }],
    },
  ]}
/>
```

## Notes

- These components intentionally reuse Finances classes/tokens for visual consistency.
- Existing legacy controls can remain until touched by feature work.
- Any new page should default to these components first, then extend only if needed.
