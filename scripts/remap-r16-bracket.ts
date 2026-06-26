/**
 * Remap stale R16+ predictions after the bracket fix.
 *
 * Usage:
 *   bun run scripts/remap-r16-bracket.ts            # dry-run
 *   bun run scripts/remap-r16-bracket.ts --apply    # write changes
 */
import { createClient } from "@supabase/supabase-js";
import { deriveKnockoutTeams } from "../src/lib/knockout-derivation";
import { deriveKnockoutTeams as deriveOld } from "./knockout-derivation-old";
import type { LocalPrediction, Match, Team } from "../src/lib/tournament-utils";

const APPLY = process.argv.includes("--apply");

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function fetchAll<T>(table: string, select = "*"): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const [teamsR, matchesR, allPreds, allBonus] = await Promise.all([
  supabase.from("teams").select("*"),
  supabase.from("matches").select("*"),
  fetchAll<any>("predictions"),
  fetchAll<any>("bonus_predictions", "user_id, group_tiebreakers"),
]);
for (const r of [teamsR, matchesR]) if (r.error) throw r.error;

const teams = teamsR.data as Team[];
const matches = matchesR.data as Match[];
const teamName = new Map(teams.map((t) => [t.id, t.name]));
const matchByNum = new Map(matches.map((m) => [m.match_number, m]));

console.log(`Loaded ${allPreds.length} predictions across all users.`);

// Group predictions by user
const byUser = new Map<string, any[]>();
for (const p of allPreds) {
  if (!byUser.has(p.user_id)) byUser.set(p.user_id, []);
  byUser.get(p.user_id)!.push(p);
}
const tiebreakersByUser = new Map<string, any[]>();
for (const b of allBonus) tiebreakersByUser.set(b.user_id, (b.group_tiebreakers as any[]) ?? []);

const TARGET_ROUNDS = ["round_of_16", "quarter_final", "semi_final", "final", "third_place"];

type Update = {
  user_id: string;
  match_id: string;
  match_number: number;
  round: string;
  old_pair: [string | null, string | null];
  new_pair: [string | null, string | null];
  old_through: string | null;
  new_through: string | null;
  old_winner: string | null;
  new_winner: string | null;
};

const updates: Update[] = [];
const tName = (id: string | null) => (id ? teamName.get(id) ?? id.slice(0, 6) : "—");

// IMPORTANT: derivation functions only fill team_a_id/team_b_id if currently
// null on the match record. We must pass match records with team_a_id/team_b_id
// set to null so derivation drives the pairings (in production, knockout
// matches start unassigned and admin fills them later).
const matchesForDerivation = matches.map((m) =>
  m.round === "group" ? m : { ...m, team_a_id: null, team_b_id: null },
);

for (const [userId, userPreds] of byUser) {
  const DBG = userId === '559bde92-adb9-4805-825d-c1937d972782';
  // Build LocalPrediction map
  const predMap: Record<string, LocalPrediction> = {};
  for (const p of userPreds) {
    predMap[p.match_id] = {
      winner_id: p.predicted_winner_id,
      score_a: p.predicted_score_a,
      score_b: p.predicted_score_b,
      team_through: p.predicted_team_through,
    };
  }
  const tb = tiebreakersByUser.get(userId) ?? [];

  const newRes = deriveKnockoutTeams(teams, matchesForDerivation, predMap, [], tb);
  const oldRes = deriveOld(teams, matchesForDerivation, predMap, [], tb);

  for (const p of userPreds) {
    const m = matches.find((mm) => mm.id === p.match_id);
    if (!m || !TARGET_ROUNDS.includes(m.round)) continue;
    if (!p.predicted_team_through && !p.predicted_winner_id) continue;
    if (DBG) console.log('DBG', m.match_number, 'oldPair', oldRes.assignments[m.id], 'newPair', newRes.assignments[m.id], 'through', p.predicted_team_through);

    const oldPair = oldRes.assignments[m.id];
    const newPair = newRes.assignments[m.id];
    if (!oldPair || !newPair) continue;

    const remap = (id: string | null): string | null => {
      if (!id) return null;
      if (id === oldPair.team_a_id) return newPair.team_a_id;
      if (id === oldPair.team_b_id) return newPair.team_b_id;
      // Pick was already not in old pair (orphaned earlier) — leave as-is
      return id;
    };

    const newThrough = remap(p.predicted_team_through);
    const newWinner = remap(p.predicted_winner_id);

    if (newThrough !== p.predicted_team_through || newWinner !== p.predicted_winner_id) {
      updates.push({
        user_id: userId,
        match_id: m.id,
        match_number: m.match_number,
        round: m.round,
        old_pair: [oldPair.team_a_id, oldPair.team_b_id],
        new_pair: [newPair.team_a_id, newPair.team_b_id],
        old_through: p.predicted_team_through,
        new_through: newThrough,
        old_winner: p.predicted_winner_id,
        new_winner: newWinner,
      });
    }
  }
}

// Group by user for readable report
const byUserUpdates = new Map<string, Update[]>();
for (const u of updates) {
  if (!byUserUpdates.has(u.user_id)) byUserUpdates.set(u.user_id, []);
  byUserUpdates.get(u.user_id)!.push(u);
}

// Lookup names
const userIds = [...byUserUpdates.keys()];
const profilesR = await supabase.from("profiles").select("user_id, first_name, last_name, username").in("user_id", userIds);
const profById = new Map((profilesR.data ?? []).map((p: any) => [p.user_id, p]));

console.log(`Users affected: ${byUserUpdates.size}`);
console.log(`Prediction rows to update: ${updates.length}`);
const perRound: Record<string, number> = {};
for (const u of updates) perRound[u.round] = (perRound[u.round] ?? 0) + 1;
console.log("By round:", perRound);

for (const [uid, ups] of byUserUpdates) {
  const prof = profById.get(uid) as any;
  const name = prof ? `${prof.first_name ?? ""} ${prof.last_name ?? ""}`.trim() || prof.username : uid;
  console.log(`\n=== ${name} (${ups.length} rows) ===`);
  ups.sort((a, b) => a.match_number - b.match_number);
  for (const u of ups) {
    console.log(
      `  M${u.match_number} [${u.round}] OLD ${tName(u.old_pair[0])} v ${tName(u.old_pair[1])} → NEW ${tName(u.new_pair[0])} v ${tName(u.new_pair[1])}` +
        `  through: ${tName(u.old_through)} → ${tName(u.new_through)}` +
        (u.old_winner !== u.new_winner ? `  winner: ${tName(u.old_winner)} → ${tName(u.new_winner)}` : ""),
    );
  }
}

if (!APPLY) {
  console.log("\nDRY RUN — no changes written. Re-run with --apply to write.");
} else {
  console.log("\nApplying updates...");
  let ok = 0, fail = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from("predictions")
      .update({ predicted_team_through: u.new_through, predicted_winner_id: u.new_winner })
      .eq("user_id", u.user_id)
      .eq("match_id", u.match_id);
    if (error) { fail++; console.error("  fail", u.user_id, u.match_number, error.message); }
    else ok++;
  }
  console.log(`Done. Updated ${ok} rows, ${fail} failures.`);
}
