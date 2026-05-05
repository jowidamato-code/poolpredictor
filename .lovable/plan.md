## Add "Test User" role

A third role that experiences the app exactly like a participant but is invisible to the tournament: not in standings, not counted in the prize pot, hidden from public participant lists.

### 1. Database

Migration:

- Extend the `app_role` enum: `ALTER TYPE public.app_role ADD VALUE 'test_user';`
- No new tables. `user_roles` already supports the new value.
- No RLS changes. Test users keep the same read/write permissions as participants — they can submit predictions normally; their data simply gets filtered out of public aggregations.

### 2. Exclusion helper (single source of truth)

In `src/lib/participants.ts`:

- Add `fetchExcludedUserIds()` returning the union of all `admin` + `test_user` user_ids.
- Update `fetchParticipantCount()` to use `fetchExcludedUserIds`.
- Keep `fetchAdminUserIds()` for places that genuinely need admin-only (e.g. the dashboard badge).

### 3. Update tournament views to use the new exclusion

- `src/components/tournament/StandingsTab.tsx` — swap `fetchAdminUserIds` → `fetchExcludedUserIds` so test users disappear from the leaderboard.
- `src/components/tournament/PrizesTab.tsx` — already calls `fetchParticipantCount`, so it picks up the change automatically (test users do not contribute to the pot).
- Any other admin/dashboard surfaces that show "all users" keep their current behavior; only public/tournament-facing views exclude test users.

### 4. Admin: create + display test users

- `src/routes/_authenticated/_admin/dashboard.tsx`:
  - Extend `accountType` union to `"admin" | "user" | "test_user"`.
  - Add a third "Test user" button in the Account-type selector.
  - Fetch test-user ids alongside admin ids; render a third badge variant ("Test", neutral/muted styling) next to participants.
  - Server validator in the same file already gates `accountType` — extend the allow-list to include `test_user`.

### 5. Auth flow

- Test users sign in via the normal `/login` page (not `/admin-login`). They should NOT be redirected to `/dashboard`.
- `src/hooks/use-auth.ts` and `src/routes/index.tsx` keep the existing `isAdmin`-only branch — test users naturally land on `/lobby` like participants.
- `auth.isAdmin` stays strictly true only for the `admin` role, so test users get zero admin UI.

### 6. Visual hint for the test user themselves (optional, recommended)

Small muted "TEST MODE" pill in the header (`AppLayout.tsx`) when the signed-in user has the `test_user` role, so QA can tell at a glance they're in test mode and their actions don't affect the real pool. Add `isTestUser` to `AuthState` similar to `isAdmin`.

### Files touched

- migration (enum value)
- `src/lib/participants.ts`
- `src/components/tournament/StandingsTab.tsx`
- `src/routes/_authenticated/_admin/dashboard.tsx`
- `src/hooks/use-auth.ts`
- `src/components/AppLayout.tsx`

### Out of scope

- No changes to predictions/bonus tables — test users save predictions exactly like participants. They're only filtered at the read/aggregation layer.
- No "convert participant ↔ test user" UI in this pass; admins can delete + recreate if needed (can add later if you want).
