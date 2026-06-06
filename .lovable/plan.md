## Goal

Replace the inline tie-resolution card in `GroupStageView` with a modal-based picker that opens explicitly, lets the user finalize the order, and a persistent badge on the standings table indicating manual resolution (with re-edit access).

## Why

- Inline card is easy to miss.
- Each arrow click saves the pick, which immediately resolves the tie and unmounts the card — making 3+ team reordering impossible.
- No indication on the standings afterwards that the order was manually chosen.

## UX flow

1. **Trigger** — Only when the group is **complete** (all 6 scores entered) AND there is at least one tied set after pts → GD → GF → H2H:
   - A button appears above the standings table: "⚖ Resolve tie — pick order for X, Y(, Z)". Styled prominently (gold border, full-width on mobile).
   - Clicking opens a Dialog.

2. **Modal contents** (`src/components/ui/dialog.tsx`):
   - Title: "Tied on points — pick the final order"
   - Subtitle explains the tiebreakers already applied (pts, GD, GF, head-to-head) couldn't separate these teams.
   - One section per unresolved tied set (a group could in theory have two separate ties). Each shows the tied teams with their identical stats (Pts / GD / GF / H2H rows for context) and up/down reorder controls.
   - **Local draft state** — reordering only mutates modal state. Nothing is saved until the user clicks **Save order**. A **Cancel** button discards changes.
   - Save calls `onResolveGroupTie` once per tied set, then closes.

3. **Post-resolution display** — When a manual pick is active for a tied set (i.e. a matching `GroupTiebreakerPick` exists for the current `tieKey`):
   - A small note above the table: "ⓘ Positions X & Y were tied — order set manually. [Change]"
   - "Change" reopens the same modal pre-filled with the saved order, allowing edits.
   - If the underlying scores change such that the teams are no longer tied (or a different subset is tied), the old `tieKey` becomes stale and the note/modal no longer references it; a new tie surfaces as a fresh prompt.

4. **Locked state** — Once predictions are locked (deadline passed), no button/modal access; if a manual order was saved, the note still shows ("order set manually") without a Change link.

## Files to touch (frontend only)

- `src/components/tournament/GroupStageView.tsx` — main changes:
  - Replace inline tie card with: (a) trigger button when unresolved & no pick yet, (b) "manually resolved" note + Change button when a pick exists for a current tie.
  - Add `GroupTieDialog` child component (kept in same file or extracted to `GroupTieDialog.tsx`).
  - Detect "manually resolved ties" by re-running `computeGroupStandingsWithTies` once **without** user picks to find all current tied sets, then comparing each `tieKey` against `groupTiebreakers` to classify as resolved-by-pick vs unresolved.
- No changes to `tournament-utils.ts` (logic already supports this).
- No changes to scoring, DB, or admin side.
- No changes to participant data model — still uses `bonus_predictions.group_tiebreakers` JSONB and the existing `onResolveGroupTie` handler in `PredictionsTab`.

## Safety

- Migration: none.
- Logic / scoring: unchanged.
- `PredictionsTab` save path: unchanged (still receives one `GroupTiebreakerPick` per save call, just batched on modal Save).
- If user has no in-progress predictions: modal never opens (gated on `isGroupComplete`).
- Locked-state path preserved: modal trigger hidden when `isLocked`.

## Out of scope

- Admin-side Group Results tab (already has the 4-row picker).
- Bracket projection logic (uses the same picks; behavior unchanged).
- Mobile-specific drag handles (up/down arrows are sufficient and accessible).
