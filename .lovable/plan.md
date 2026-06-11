# Fix deadline timezone + extend by 2 hours

## 1. Admin Settings — interpret input as Malta time

File: `src/routes/_authenticated/_admin/settings.tsx`

The `datetime-local` input currently treats whatever the admin types as **browser-local** time, then converts to UTC. On a browser running in Malta (CEST, UTC+2) that's accidentally correct, but on a server/CI clock or a browser in UTC it shifts by 2 hours — which is the "set 10:00, displays 12:00" bug.

Replace the read/write helpers so the input always represents Malta wall-clock time, independent of the browser's timezone:

- **Display (UTC ISO → "YYYY-MM-DDTHH:mm" Malta)**: use `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Malta', year, month, day, hour, minute, hour12: false })` and reassemble.
- **Save ("YYYY-MM-DDTHH:mm" Malta → UTC ISO)**: build the UTC instant by computing Malta's offset for that date (using a probe `Intl.DateTimeFormat` with `timeZoneName: 'shortOffset'`, or the standard "format-as-UTC, diff against format-as-Malta" trick) and subtracting it from the naive UTC parse.

Add a small read-only line under the input: `Stored as: <UTC ISO>` so the admin can sanity-check.

## 2. Extend current deadline by 2 hours → 14:00 Malta

Update the `prediction_deadline` row in `settings` from `2026-06-11T11:00:00.000Z` (= 13:00 Malta, the buggy value) to `2026-06-11T12:00:00.000Z` (= **14:00 Malta**, CEST UTC+2).

Done via a one-off `UPDATE settings SET value = '"2026-06-11T12:00:00.000Z"' WHERE key = 'prediction_deadline'` (the value column is JSONB and we store quoted strings, matching the existing format).

## 3. Append "(extended by 2 hours)" to every deadline display

Locations:

1. `src/components/tournament/PredictionsTab.tsx` line 442 — the "Deadline: …" line.
2. `src/components/tournament/RulesTab.tsx` line 146 — Prediction Deadline card.
3. `src/components/PublicRulesModal.tsx` — Prediction Deadline card.
4. `src/routes/_authenticated/lobby.tsx` line 147 — Deadline label on the lobby tile.

In each, render `(extended by 2 hours)` next to the date/time. Styling: small, muted (`text-xs text-muted-foreground` or equivalent) so it reads as a note, not as part of the timestamp. Static string — no toggle/flag.

## Files touched

- `src/routes/_authenticated/_admin/settings.tsx` (timezone-correct datetime-local handling + UTC echo)
- `src/components/tournament/PredictionsTab.tsx` (append note)
- `src/components/tournament/RulesTab.tsx` (append note)
- `src/components/PublicRulesModal.tsx` (append note)
- `src/routes/_authenticated/lobby.tsx` (append note)
- One DB update to `settings.prediction_deadline`

No changes to lock logic, scoring, or any other behaviour.
