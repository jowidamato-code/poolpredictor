Change the `WhatsNewBanner` from an inline banner into a centered modal dialog using the existing `Dialog` component from `src/components/ui/dialog.tsx`.

**What to build:**
- Replace the banner layout in `WhatsNewBanner.tsx` with a `Dialog` that opens automatically when the user hasn't dismissed it.
- Keep the same localStorage key (`seen-tiebreaker-banner-v1`) so users who already dismissed the banner won't see the modal again.
- Add a primary button "Got it" that dismisses the modal (same as today).
- Add a secondary "Never show again" button that also dismisses and writes to localStorage — functionally equivalent, but the two-button layout makes the permanent dismissal explicit.
- Style the modal with the project's gold accent theme (border-gold/40, bg-gold/5, text-gold) to match the existing banner styling.
- `PredictionsTab.tsx` continues to render `<WhatsNewBanner />` in the same spot; no other changes needed.