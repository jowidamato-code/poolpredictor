## One-time "Deadline extended" popup

Add a one-time modal that shows on next login for participants, modeled on the existing `WhatsNewBanner` pattern (localStorage flag, dismiss permanently).

### New component: `src/components/tournament/DeadlineExtendedBanner.tsx`
- Uses shadcn `Dialog` (same as `WhatsNewBanner`).
- localStorage key: `seen-deadline-extended-v1`. On mount, if not set → open. Dismiss button sets the key and closes.
- Single "Got it" button (gold style, matching existing banner).

**Content:**
- Title: **Deadline extended by 2 hours — now 14:00 Malta time**
- Body: "We identified a bug that locked predictions for some users for roughly 12 minutes between 11:00 and 11:12 Malta time. To make up for it, we've extended the deadline by 2 hours, to 14:00 Malta time. Apologies for the inconvenience — and good luck with your predictions!"

### Wiring
- Render inside `src/routes/_authenticated/lobby.tsx` (first page participants land on after login), alongside any existing banner. Admins also pass through lobby only if they navigate there — primary audience is participants, which matches the requirement.
- Component is self-gated by localStorage, so safe to mount unconditionally.

### Out of scope
- No DB changes, no per-user server-side flag (localStorage is sufficient for "next login on this device", matching the existing `WhatsNewBanner` approach already in the app).
- No changes to lock logic, deadline value, or scoring.
