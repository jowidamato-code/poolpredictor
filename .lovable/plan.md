## Goal

Two small safety nets so existing participants aren't surprised by the new tiebreaker logic:

1. A one-time, dismissible "What's new" banner on the Predictions page mentioning only the manual tiebreaker picker.
2. An inline amber warning on any knockout match where the user's saved winner/team-through pick is no longer one of the two projected teams (stale pick).

## 1. "What's new" banner

**Placement:** Top of `PredictionsTab` content, above the round selector.

**Copy:**
> **New: manual tiebreaker picker**
> If two or more teams in a group end up tied even after points, goal difference, goals scored, and head-to-head, you can now pick their final order yourself. Look for the gold "Resolve tie" button on any group where this applies.

**Dismissal:** "Got it" button. Persisted in `localStorage` under key `seen-tiebreaker-banner-v1` (per-browser, per-user is good enough — no DB column needed). Hidden permanently after dismissal.

**Files:** new `src/components/tournament/WhatsNewBanner.tsx` (small presentational component, reads/writes localStorage in a `useEffect`); rendered from `PredictionsTab.tsx`.

## 2. Stale pick warning on knockout matches

**Detection (in `KnockoutBracketView.tsx`, inside the match render around line 265):**
- Get `existing.predicted_winner_id` and `existing.predicted_team_through` (if any) from `predictions[m.id]`.
- Get current projected `slot.team_a_id` / `slot.team_b_id`.
- A pick is **stale** when both teams are projected (non-null) AND the saved id is non-null AND the saved id ≠ either projected team id.
- Skip when either projected team is still null (round not derivable yet — not stale, just pending).
- Skip when the match is `played`/locked at the actual tournament (admin has filled real teams).

**UI:** Small amber notice below the score row inside the match Card:
> ⚠ Your previous pick (**{teamName}**) is no longer in this matchup — please repick.

Uses `text-gold` / `border-gold/40 bg-gold/5` to match the existing tiebreaker styling. Resolves to `teamMap[stalePickId]?.name` for the team label; falls back to "your team" if unknown.

**Behavior:** Purely visual — does NOT auto-clear the stored prediction. The user repicks via the existing winner buttons, which overwrites the row through the normal save path. No data migration, no destructive auto-clear (preserves the original intent if the projected matchup changes again before the deadline).

## Files to touch

- `src/components/tournament/WhatsNewBanner.tsx` — new file.
- `src/components/tournament/PredictionsTab.tsx` — render `<WhatsNewBanner />` above tab content.
- `src/components/tournament/KnockoutBracketView.tsx` — add stale-pick computation and amber notice inside the match Card.

## Out of scope

- Backend changes / migrations (banner state stays in localStorage).
- Auto-clearing or rewriting stored predictions.
- Banners for the upgraded H2H sort (silent improvement — no user action needed).
- Knockout view in admin's "MyPredictionsTab" read-only display (warning is for the editable view only).

## Safety

- Banner: pure additive component, gated on `localStorage`. No effect on scoring or saves.
- Warning: read-only; no state writes, no side effects, no logic-path changes.
- Existing predictions and saves: completely untouched.
