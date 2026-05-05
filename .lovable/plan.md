## Easter egg: tribute to Alex, Miguel & Lawrence

Two small additions, no DB, no new deps.

### 1. Console signature (on app load)

In `src/router.tsx` (or `src/routes/__root.tsx` inside a `useEffect` so it only runs once client-side), print a styled message:

```
%cPool Predictor
%cBuilt with help from Alex, Miguel & Lawrence — the OG squad 🏆
```

Styled with the brand green + gold so it looks intentional in DevTools. Guarded by a module-level flag so it only logs once per session (avoids HMR spam).

### 2. Logo click easter egg (header)

In `src/components/AppLayout.tsx`, wrap the logo `<Link>` interaction:

- Track click count in a `useRef` (resets on reload).
- On the 5th click within a 3-second rolling window, fire:
  - A `sonner` toast: *"Shoutout to Alex, Miguel & Lawrence — the OGs who helped build this 🏟️"*
  - Mount the existing `<Fireworks />` component for ~3 seconds.
- Reset counter after firing so it can be re-triggered later.
- Normal navigation to `/lobby` still works on every click (the counter is additive, not a replacement).

### Files touched

- `src/routes/__root.tsx` — add one-time console log effect
- `src/components/AppLayout.tsx` — add click counter + toast + Fireworks overlay

No backend, no schema, no new packages. Reuses existing `Fireworks` component and `sonner`.
