## What broke

The recent security migration tightened RLS on `user_roles` so that signed-in users can only read **their own** role row. That's the correct security posture, but it silently broke `fetchExcludedUserIds()` in `src/lib/participants.ts`.

That helper does a client-side query:

```ts
supabase.from("user_roles").select("user_id, role").in("role", ["admin","test_user"])
```

For a regular participant, RLS now filters that result down to nothing. The returned `Set` is empty, so:

- `StandingsTab` no longer filters out admins / test users → they appear on the leaderboard.
- `fetchParticipantCount()` counts them as participants → the prize pot is inflated by their entry fees (and they're shown in counts).
- Same impact anywhere else `fetchExcludedUserIds` / `fetchParticipantCount` is used.

Admins still saw the correct list (their RLS policy lets them read everything), which is why this only shows up on non-admin sessions.

## Fix

Expose the exclusion list through the server, not the browser, so it doesn't depend on the caller's RLS view of `user_roles`.

1. Add a new server function `getExcludedUserIds` in `src/lib/participants.functions.ts` using `requireSupabaseAuth` middleware + the admin client (or a SECURITY DEFINER SQL function) to return the `user_id`s with role `admin` or `test_user`. Any authenticated user may call it — it returns only opaque UUIDs, no PII.
2. Rewrite `fetchExcludedUserIds()` in `src/lib/participants.ts` to call that server fn and return the `Set<string>`. Keep the same signature so all existing call sites (`StandingsTab`, `PrizesTab`, `fetchParticipantCount`, etc.) keep working with no further changes.
3. `fetchAdminUserIds()` has the same RLS problem for non-admin viewers — give it the same treatment (server fn returning just admin ids).
4. No DB migration required; RLS stays locked down. No UI changes.

### Technical notes
- Server fn uses `supabaseAdmin` scoped to `select user_id from user_roles where role in ('admin','test_user')` — returns UUIDs only.
- Alternative: a `SECURITY DEFINER` SQL function `public.excluded_user_ids()` returning `setof uuid`, called via the authed client. Either works; the server-fn route keeps logic in app code and avoids another migration.

### Verification
- Sign in as a regular participant, open Standings → admin + test users no longer appear.
- Open Prizes → participant count and pot match (15 total − 1 admin − 2 test = 12 participants).
