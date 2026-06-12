# Tournament UI Polish (cosmetic only)

No database, scoring, or business-logic changes. Pure presentation tweaks.

## 1. Reorder tabs in `src/routes/_authenticated/tournament.tsx`

New order (left → right), with `defaultValue` set to `my-predictions` so customers land on My Picks first:

1. My Picks (`my-predictions`)
2. Standings (`standings`)
3. Predictions (`predictions`)
4. Prizes (`prizes`)
5. Rules (`rules`)

Just reorder the `<TabsTrigger>` and `<TabsContent>` blocks and update `defaultValue`. No prop or data changes.

## 2. Sort matches by kickoff in `src/components/tournament/MyPredictionsTab.tsx`

Within each round, sort matches by `match_date` ascending (nulls last as a tiebreaker by `match_number`). Implementation: after `.filter((m) => m.round === round)` add `.sort((a, b) => { if (!a.match_date) return 1; if (!b.match_date) return -1; const d = new Date(a.match_date).getTime() - new Date(b.match_date).getTime(); return d !== 0 ? d : (a.match_number - b.match_number); })`.

Also reorder the `rounds` array so it follows tournament chronology — currently derived from `matches` insertion order (already match_number-ordered from query) which is already chronological for round groupings, so no change needed there.

## 3. Standings tab in `src/components/tournament/StandingsTab.tsx`

a. **Highlight current user's row.** Get `auth.user.id` via `useAuthContext` (same pattern as `tournament.tsx`). If `player.user_id === currentUserId`, apply an extra class to the row: a subtle gold/primary tint background (`bg-gold/15`) plus a left border accent (`border-l-4 border-gold`) and bolder name. Add a small "You" badge next to the name.

b. **Clickable affordance.** Currently rows are clickable after deadline but visually only differ on hover. Add a persistent visual cue when `deadlinePassed`:
- Tiny chevron (`ChevronRight` from lucide) at far right of each row.
- Helper hint line above the list: "Tap any name to view their predictions" (only after deadline passed).
- Keep existing hover/cursor states.

## Files touched

- `src/routes/_authenticated/tournament.tsx` — tab order + default value
- `src/components/tournament/MyPredictionsTab.tsx` — sort by `match_date`
- `src/components/tournament/StandingsTab.tsx` — highlight current user, add chevron + hint

## Out of scope

No DB writes, no settings edits, no scoring/results changes, no auth changes, no route changes beyond tab default.
