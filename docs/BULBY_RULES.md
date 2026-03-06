# Bulby Rules and Learnings

Updated: 2026-03-06T00:00:00.000Z

## Active Rules
- Prefer internal project data before external web search.
- Answer expense questions from expense records when possible.
- Ask one precise clarification when required context is missing.
- Never claim a calendar action succeeded unless the calendar API actually succeeded.
- If a calendar action is unsupported or fails, say so clearly instead of implying it was completed.
- After successful calendar create, update, or delete actions, refresh the visible calendar state.
- Never claim a bug action succeeded unless the bug API actually succeeded.
- If a bug action is unsupported or fails, say so clearly instead of implying it was completed.
- After successful bug create, update, or delete actions, refresh the visible bug state.

## Learnings
- No saved learnings yet.

## Journal
- [rule] 2026-03-01T04:05:32.000Z | Mobile first-tap open: Bulby must open on the first mobile tap without requiring a second tap or double-triggering from synthetic clicks.
- [rule] 2026-03-01T04:26:16.000Z | Drag interaction stability: When Bulby is dragged, the panel should close during drag and reopen after drag end instead of getting stuck or mispositioned.
- [rule] 2026-03-06T00:00:00.000Z | Input focus retention: After Bulby responds, the text input should stay focused so follow-up typing works without extra clicks.
- [rule] 2026-03-06T00:00:00.000Z | Mobile panel visibility while thinking: While Bulby is thinking on mobile, the panel must remain on-screen and usable.
- [rule] 2026-03-06T00:00:00.000Z | Calendar question routing: Calendar questions for today, explicit dates, weeks, and date ranges must answer from synced calendar data instead of generic assistant text.
- [rule] 2026-03-06T00:00:00.000Z | Calendar create truthfulness: Bulby must not say a calendar event was added unless createCalendarEvent succeeded.
- [rule] 2026-03-06T00:00:00.000Z | Calendar follow-up completion: When Bulby asks for a missing time, the next reply must complete the pending calendar create instead of falling back to generic assistant text.
- [rule] 2026-03-06T00:00:00.000Z | Calendar UI refresh after mutation: After successful calendar create, update, or delete actions, Bulby must refresh the visible calendar state so the UI reflects the backend result.
- [rule] 2026-03-06T00:00:00.000Z | Calendar edit intent handling: Calendar edit requests must use a real update handler and call updateCalendarEvent instead of summarizing events.
- [rule] 2026-03-06T00:00:00.000Z | Calendar delete intent handling: Calendar delete requests must find matching events and call deleteCalendarEvent instead of generating a false success message.
- [rule] 2026-03-06T00:00:00.000Z | Unsupported mutation refusal: If Bulby cannot perform an app mutation through a real API handler, it must say it could not complete the action and must never imply success.
