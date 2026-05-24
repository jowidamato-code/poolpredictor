## Goal

Rewrite the knockout bracket derivation so user predictions populate the Round of 32 using the official FIFA 2026 structure (winners vs 3rd-place teams from a fixed eligibility pool, runners-up matchups, no same-group meetings before QF), with a manual tiebreaker prompt only when ties fall at the 8th/9th cutoff for 3rd-place qualification.

Today `src/lib/knockout-derivation.ts` uses a generic "seed[0] vs seed[31]" pairing and a flat top-8-thirds list — it does not implement the FIFA bracket. This plan replaces that logic.

## Scope

- **Logic only**: `src/lib/knockout-derivation.ts` (the single source of truth used by `KnockoutBracketView`).
- **UI addition**: a tiebreaker modal triggered from `PredictionsTab` / `KnockoutBracketView` when an ambiguous 8/9 cutoff is detected.
- **Persistence**: store the user's manual cutoff choices so they survive reload.
- No changes to admin scoring, fixtures, or DB match numbering (DB already uses FIFA-standard match_number 73–88 for R32 — your spec's "74–89" is the same 16 matches, just off by one in labeling; I'll key off the existing match_number ordering).

## Part 1 — 3rd-place qualification

In `knockout-derivation.ts`:

1. Compute full group standings (already done) and extract the 12 third-place finishers.
2. Sort them by: points → goal difference → goals scored.
3. **Tie detection at the cutoff (positions 8/9)**:
   - Group teams that share identical (pts, gd, gf).
   - A tie is "ambiguous" only if a single equivalence-class straddles the 8/9 boundary (some members would be in, some out, and the user's manual picks haven't fully resolved it).
   - Ties entirely inside top 8, or entirely outside, are NOT ambiguous and need no prompt.
4. Apply the user's stored manual cutoff picks (see Persistence) to resolve ambiguous classes.
5. If still unresolved → the derivation returns a `cutoffTieGroups` array; UI surfaces the prompt. Until resolved, leave the affected R32 "Best 3rd" slots empty (TBD).
6. For each of the 8 qualifying 3rd-place teams, retain their group letter (A–L).

## Part 2 — Round of 32 official matchups

Hard-code the FIFA 2026 bracket as a table keyed by R32 match index (0–15, in match_number order):

```text
idx  Winner-vs-Winner/RunnerUp           "Best 3rd" eligible pool
0    Winner E vs Best 3rd                {A,B,C,D,F}
1    Winner F vs Runner-up C             —
2    Winner C vs Runner-up F             —
3    Winner I vs Best 3rd                {C,D,F,G,H}
4    Runner-up E vs Runner-up I          —
5    Winner A vs Best 3rd                {C,E,F,H,I}
6    Winner L vs Best 3rd                {E,H,I,J,K}
7    Winner D vs Best 3rd                {B,E,F,I,J}
8    Winner G vs Best 3rd                {A,E,H,I,J}
9    Runner-up K vs Runner-up L          —
10   Winner H vs Runner-up J             —
11   Winner B vs Best 3rd                {E,F,G,I,J}
12   Winner J vs Runner-up H             —
13   Runner-up A vs Runner-up D          —
14   Winner K vs Best 3rd                {D,E,I,J,L}
15   Runner-up B vs Runner-up G          —
```

**3rd-place slotting algorithm** (only when all 8 qualifiers are known and unambiguous):

```text
qualified = the 8 qualifying 3rd-place teams keyed by source group
for each R32 match in match_number order with a "Best 3rd" slot:
    pick the qualifier whose group is in this slot's pool
    AND who has not yet been assigned
    assign to that slot
if no eligible qualifier exists for a slot → leave TBD
```

This greedy in-order pass matches FIFA's published 2026 assignment table.

## Part 3–6 — Downstream rounds

Replace the current "winners[i*2] vs winners[i*2+1]" chain with the explicit map:

- R16 matches 89–96 (DB match_number) pair R32 winners as: (74,75), (76,77), (78,79), (80,81), (82,83), (84,85), (86,87), (88,89) — i.e. consecutive R32 pairs in match-number order, which matches your spec.
- QF (97–100): (R16-1,R16-2), (R16-3,R16-4), (R16-5,R16-6), (R16-7,R16-8).
- SF (101–102): (QF1,QF2), (QF3,QF4).
- 3rd place (103): losers of SF1 and SF2.
- Final (104): winners of SF1 and SF2.

This is essentially what the code does today, but I'll express it as an explicit pairing map rather than positional pairing so it's auditable against the FIFA bracket.

## Manual tiebreaker UI

- `KnockoutBracketView` receives `cutoffTieGroups: Array<{ teams: ThirdPlaceStat[]; slotsAvailable: number }>` plus an `onResolveTie(picked: string[])` callback from `PredictionsTab`.
- When non-empty, render a non-blocking banner above the bracket: *"Some 3rd-place teams are tied and we can't separate them. Pick which advance to fill the Round of 32."* with a button opening an `AlertDialog`.
- Dialog lists each tied class with team name + group + pts/gd/gf, lets the user select exactly `slotsAvailable` teams.
- On confirm, save to DB and re-derive.

## Persistence

Add a `third_place_tiebreakers` `jsonb` column (default `'[]'`) to `bonus_predictions`. Shape:

```json
[{ "tieKey": "pts:3|gd:0|gf:3", "advancing": ["team-uuid-1", "team-uuid-2"] }]
```

`tieKey` is derived from the tied stats so old picks auto-invalidate if predictions change. `PredictionsTab` loads it alongside other bonus data and passes into the derivation.

## Files to change

- `src/lib/knockout-derivation.ts` — full rewrite of 3rd-place ranking, R32 slotting, downstream chaining; expose `cutoffTieGroups`.
- `src/components/tournament/KnockoutBracketView.tsx` — accept and surface tiebreaker info; render banner + dialog.
- `src/components/tournament/PredictionsTab.tsx` — load/save `third_place_tiebreakers`; thread state to bracket view.
- Migration: add `third_place_tiebreakers jsonb not null default '[]'::jsonb` to `bonus_predictions`.

## Risk / safety (users are live)

- Pure-derivation changes are client-side and only affect the "predicting" UX (auto-filled bracket teams). They do not alter saved per-match predictions in the DB.
- Existing predictions remain valid; the new derivation just re-slots which Best-3rd team appears where. If a user's previously-saved R32 prediction was tied to a now-different team slot, the score prediction stays attached to the **match**, not the team — this matches current behavior.
- Migration is additive (new nullable-with-default column), no destructive changes.
- I'll ship behind no flag but verify in preview before publish.

## Out of scope

- Admin-side bracket population from real results (admin still enters knockout teams manually).
- Scoring changes.
- Any change to group-stage standings logic beyond what's needed to expose 3rd-place stats.