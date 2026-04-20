// Derives knockout bracket team assignments from a user's group-stage
// predictions, so the bracket populates immediately for predicting without
// waiting for the admin to assign teams to knockout fixtures.
//
// FIFA World Cup 2026 — 48 teams, top 2 of each group + 8 best 3rd-place
// progress to a Round of 32. Without an admin-defined seeding map we use
// a simplified, deterministic seeding: top 2 from each of the 12 groups
// fill 24 of the 32 R32 slots, the 8 remaining slots are filled by the
// best 8 third-placed teams (by points, GD, GF). Pairings then follow the
// match_number order of knockout fixtures already in the database.

import type { LocalPrediction, Match, Team } from "./tournament-utils";

interface GroupStats {
  team_id: string;
  group_name: string;
  pts: number;
  gd: number;
  gf: number;
  position: 1 | 2 | 3 | 4;
}

function computeAllStandings(
  teams: Team[],
  groupMatches: Match[],
  predictions: Record<string, LocalPrediction>,
): GroupStats[] {
  const byGroup: Record<string, Team[]> = {};
  for (const t of teams) (byGroup[t.group_name] ??= []).push(t);

  const result: GroupStats[] = [];
  for (const [group, gTeams] of Object.entries(byGroup)) {
    const stats: Record<string, { pts: number; gd: number; gf: number }> = {};
    for (const t of gTeams) stats[t.id] = { pts: 0, gd: 0, gf: 0 };

    const gMatches = groupMatches.filter(
      (m) =>
        m.team_a_id &&
        m.team_b_id &&
        stats[m.team_a_id] &&
        stats[m.team_b_id],
    );
    for (const m of gMatches) {
      const p = predictions[m.id];
      if (!p || p.score_a == null || p.score_b == null) continue;
      const a = stats[m.team_a_id!];
      const b = stats[m.team_b_id!];
      a.gf += p.score_a;
      a.gd += p.score_a - p.score_b;
      b.gf += p.score_b;
      b.gd += p.score_b - p.score_a;
      if (p.score_a > p.score_b) a.pts += 3;
      else if (p.score_b > p.score_a) b.pts += 3;
      else {
        a.pts++;
        b.pts++;
      }
    }
    const sorted = gTeams.slice().sort((x, y) => {
      const sx = stats[x.id], sy = stats[y.id];
      return sy.pts - sx.pts || sy.gd - sx.gd || sy.gf - sx.gf;
    });
    sorted.forEach((t, idx) => {
      result.push({
        team_id: t.id,
        group_name: group,
        pts: stats[t.id].pts,
        gd: stats[t.id].gd,
        gf: stats[t.id].gf,
        position: (idx + 1) as 1 | 2 | 3 | 4,
      });
    });
  }
  return result;
}

/**
 * Build the ordered list of teams for the Round of 32 based on the user's
 * group predictions. Returns 32 team_ids (or null where a slot can't be
 * derived). Order corresponds to R32 match_number ascending: index
 * 0/1 = match 1 team A/B, 2/3 = match 2 A/B, etc.
 */
function buildR32Teams(standings: GroupStats[]): (string | null)[] {
  // Group winners (1st), runners-up (2nd), thirds
  const groups = Array.from(new Set(standings.map((s) => s.group_name))).sort();
  const winners: Record<string, string | undefined> = {};
  const runners: Record<string, string | undefined> = {};
  const thirds: GroupStats[] = [];
  for (const s of standings) {
    if (s.position === 1) winners[s.group_name] = s.team_id;
    else if (s.position === 2) runners[s.group_name] = s.team_id;
    else if (s.position === 3) thirds.push(s);
  }

  // Best 8 third-placed teams
  const top8Thirds = thirds
    .slice()
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
    .slice(0, 8)
    .map((s) => s.team_id);

  // Build a flat seed list: for each group in order: winner, runner-up.
  // Then append top-8 thirds. Total = 12*2 + 8 = 32.
  const seeds: (string | null)[] = [];
  for (const g of groups) {
    seeds.push(winners[g] ?? null);
    seeds.push(runners[g] ?? null);
  }
  for (const id of top8Thirds) seeds.push(id);
  while (seeds.length < 32) seeds.push(null);

  // Pair seed[0] vs seed[31], seed[1] vs seed[30], ... — common bracket pairing
  // Returns 32 entries (16 matches × 2 teams) in match_number order.
  const pairs: (string | null)[] = [];
  for (let i = 0; i < 16; i++) {
    pairs.push(seeds[i]);
    pairs.push(seeds[31 - i]);
  }
  return pairs;
}

/**
 * Returns a derived map of matchId -> { team_a_id, team_b_id } for all
 * knockout matches, computed from the user's predictions. Only fills slots
 * that are currently null/empty in the DB; respects any teams already
 * assigned by the admin.
 */
export function deriveKnockoutTeams(
  teams: Team[],
  matches: Match[],
  predictions: Record<string, LocalPrediction>,
): Record<string, { team_a_id: string | null; team_b_id: string | null }> {
  const out: Record<string, { team_a_id: string | null; team_b_id: string | null }> = {};
  for (const m of matches) {
    out[m.id] = { team_a_id: m.team_a_id, team_b_id: m.team_b_id };
  }

  const groupMatches = matches.filter((m) => m.round === "group");
  const standings = computeAllStandings(teams, groupMatches, predictions);
  const r32Teams = buildR32Teams(standings);

  // Sort knockout matches by match_number so we can index by round
  const byRound: Record<string, Match[]> = {};
  for (const m of matches) {
    if (m.round === "group") continue;
    (byRound[m.round] ??= []).push(m);
  }
  for (const r of Object.keys(byRound)) {
    byRound[r].sort((a, b) => a.match_number - b.match_number);
  }

  // Fill R32
  const r32 = byRound["round_of_32"] ?? [];
  r32.forEach((m, i) => {
    if (!out[m.id].team_a_id) out[m.id].team_a_id = r32Teams[i * 2] ?? null;
    if (!out[m.id].team_b_id) out[m.id].team_b_id = r32Teams[i * 2 + 1] ?? null;
  });

  // Helper: given a match, who does the user predict will win?
  const predictedWinner = (m: Match): string | null => {
    const p = predictions[m.id];
    if (!p || p.score_a == null || p.score_b == null) return null;
    const a = out[m.id].team_a_id;
    const b = out[m.id].team_b_id;
    if (!a || !b) return null;
    if (p.score_a > p.score_b) return a;
    if (p.score_b > p.score_a) return b;
    return p.team_through ?? null;
  };

  // Chain winners through subsequent rounds
  const chain: Array<[string, string]> = [
    ["round_of_32", "round_of_16"],
    ["round_of_16", "quarter_final"],
    ["quarter_final", "semi_final"],
    ["semi_final", "final"],
  ];
  for (const [from, to] of chain) {
    const fromMatches = byRound[from] ?? [];
    const toMatches = byRound[to] ?? [];
    const winners = fromMatches.map(predictedWinner);
    toMatches.forEach((m, i) => {
      if (!out[m.id].team_a_id) out[m.id].team_a_id = winners[i * 2] ?? null;
      if (!out[m.id].team_b_id) out[m.id].team_b_id = winners[i * 2 + 1] ?? null;
    });
  }

  // Third-place: losers of the two semi-finals
  const semis = byRound["semi_final"] ?? [];
  const third = (byRound["third_place"] ?? [])[0];
  if (third && semis.length === 2) {
    const loserOf = (m: Match): string | null => {
      const p = predictions[m.id];
      const a = out[m.id].team_a_id;
      const b = out[m.id].team_b_id;
      if (!a || !b || !p || p.score_a == null || p.score_b == null) return null;
      if (p.score_a > p.score_b) return b;
      if (p.score_b > p.score_a) return a;
      return p.team_through === a ? b : p.team_through === b ? a : null;
    };
    if (!out[third.id].team_a_id) out[third.id].team_a_id = loserOf(semis[0]);
    if (!out[third.id].team_b_id) out[third.id].team_b_id = loserOf(semis[1]);
  }

  return out;
}
