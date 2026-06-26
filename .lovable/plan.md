## Root cause

`R32_SLOTS` in `src/lib/knockout-derivation.ts` was authored without **M73 (RU-A vs RU-B)**. Every entry is shifted up by one index, and the last two slots are filled with two fabricated pairings (`RU-A vs RU-D`, `RU-B vs RU-G`) instead of the real M73 and M88.

`THIRD_PLACE_ALLOCATION` (`src/lib/third-place-allocation.ts`) has correct *values* (FIFA-official), but its key labels (`M74…M88`) were named off the broken indices — the last column is really M87, not M88.

## Fix (code)

1. **`src/lib/knockout-derivation.ts` → `R32_SLOTS`** — rewrite to the 16 official pairings, in this order (idx 0 = M73 … idx 15 = M88):

   ```
   M73 RU-A  vs RU-B
   M74 W-E   vs Best3(A,B,C,D,F)
   M75 W-F   vs RU-C
   M76 W-C   vs RU-F
   M77 W-I   vs Best3(C,D,F,G,H)
   M78 RU-E  vs RU-I
   M79 W-A   vs Best3(C,E,F,H,I)
   M80 W-L   vs Best3(E,H,I,J,K)
   M81 W-D   vs Best3(B,E,F,I,J)
   M82 W-G   vs Best3(A,E,H,I,J)
   M83 RU-K  vs RU-L
   M84 W-H   vs RU-J
   M85 W-B   vs Best3(E,F,G,I,J)
   M86 W-J   vs RU-H
   M87 W-K   vs Best3(D,E,I,J,L)
   M88 RU-D  vs RU-G
   ```

2. **`src/lib/knockout-derivation.ts` → `BEST3_SLOTKEY_BY_MATCH`** — rename the `M88` key to `M87` and recompute every `idx`/`slotKey` to match the new `R32_SLOTS` indices:

   ```
   M74 → idx 1,  slotKey 3
   M77 → idx 4,  slotKey 9
   M79 → idx 6,  slotKey 13
   M80 → idx 7,  slotKey 15
   M81 → idx 8,  slotKey 17
   M82 → idx 9,  slotKey 19
   M85 → idx 12, slotKey 25
   M87 → idx 14, slotKey 29
   ```

3. **`src/lib/third-place-allocation.ts`** — rename the `Best3Slot` type member `"M88"` → `"M87"` and rename the `M88` key to `M87` in all 495 rows (mechanical find-and-replace; values stay identical). Update the header comment column mapping (`1K→M88` becomes `1K→M87`).

4. **Build check** — `tsgo` and the existing tournament tests in `src/lib/tournament-utils*` will catch any straggling reference to `M88`.

No DB migration. Match rows in the `matches` table are addressed by `match_number` (73…88) and are unaffected; this is purely the derivation map used to fill empty `team_a_id`/`team_b_id` slots in the bracket UI.

## Implications for users mid-tournament

This is the part to be careful about. Two scenarios per R32 match:

- **Admin has already assigned the real teams to that R32 match** (`team_a_id`/`team_b_id` set in `matches`): nothing changes in the UI. Derivation only fills empty slots, so user predictions on those matches keep applying to the assigned teams.
- **R32 match still empty (teams derived from group-stage picks)**: the derived team in every R32 slot will change, because the slots shift. A user who entered a score for "M73" believing it was W-E vs Best3 will, after the fix, see RU-A vs RU-B in M73 — the score they entered is still on that DB row, but it now applies to a different matchup. Every R32 fixture is affected, not just M73 and M88.

  The downstream rounds (R16 → QF → SF → F → 3rd-place) chain from R32 winners, so any user whose R32 picks shift will also see different teams further down the bracket until they re-pick.

### Recommended user-facing handling (please confirm)

Pick one — I'd suggest **A** if the deadline has not passed, **B** if it has:

- **A. If predictions are still open:** ship the fix, then post a banner in My Picks / Predictions explaining the R32 pairings were corrected and asking users to review their knockout picks. No data is wiped; users just re-save where they want to change.
- **B. If predictions are locked:** ship the fix, and decide with you whether to (i) reopen R32+ for a short window for everyone, or (ii) leave existing scores attached to the corrected matchups and accept that some users effectively predicted the wrong fixture. Scoring is unaffected by the code change itself — it always compares the prediction on a match row to that same match row's actual result, so once admins enter real teams + scores, points are computed against the correct fixture either way.

Either way, I'll also notify in-app (small banner in MyPredictionsTab) so users aren't surprised by changed teams in their bracket.

## Out of scope

- No changes to scoring logic, RLS, or DB schema.
- No edits to `THIRD_PLACE_ALLOCATION` row *values* (they're FIFA-correct), only the column key rename.
- Group-stage tab, standings, and bonus tabs are untouched.

## Open question before I implement

1. Are R32 matches already populated with `team_a_id`/`team_b_id` by an admin, or are they still relying on derivation? (Determines how many users actually see shifted matchups.)
2. Which of A/B above for user comms?