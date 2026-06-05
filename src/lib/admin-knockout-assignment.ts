// Computes suggested knockout slot assignments for the ADMIN side, based on
// the actual played group-stage results (+ any group_results overrides) and
// the actual played knockout-match winners. Mirrors the participant-side
// derivation in knockout-derivation.ts but driven by real data, not by a
// single user's predictions.

import type { Team } from "./tournament-utils";
import {
  R32_SLOTS,
  type R32Slot,
  type GroupStats,
  type CutoffTieGroup,
  type TiebreakerPick,
  rankThirdPlace,
  assignBest3rdSlots,
} from "./knockout-derivation";

export interface AdminMatchRow {
  id: string;
  round: string;
  match_number: number;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  played: boolean;
}

export interface GroupResultOverride {
  group_name: string;
  winner_team_id: string | null;
  runner_up_team_id: string | null;
  third_place_team_id?: string | null;
  fourth_place_team_id?: string | null;
}

export interface SlotSuggestion {
  team_a_id: string | null;
  team_b_id: string | null;
}

export interface AdminKnockoutResult {
  /** Suggested team assignments per match id (knockout matches only). */
  suggestions: Record<string, SlotSuggestion>;
  /** Per-knockout-match list of eligible team ids per slot for the inline picker. */
  eligible: Record<string, { a: string[]; b: string[] }>;
  /** Standings of all teams across all 12 groups (1..4). */
  standings: GroupStats[];
  /** 3rd-place cutoff equivalence classes that the admin needs to resolve. */
  cutoffTieGroups: CutoffTieGroup[];
  /** True when the 8 qualifying 3rd-placers were slotted via the greedy
   *  pool-match fallback (i.e. the FIFA 495-entry lookup didn't have a
   *  matching key — should never happen with 8 qualifiers; safety net). */
  best3UsedFallback: boolean;
}

function computeStandingsFromActual(
  teams: Team[],
  groupMatches: AdminMatchRow[],
): GroupStats[] {
  const byGroup: Record<string, Team[]> = {};
  for (const t of teams) (byGroup[t.group_name] ??= []).push(t);

  const result: GroupStats[] = [];
  for (const [group, gTeams] of Object.entries(byGroup)) {
    const stats: Record<string, { pts: number; gd: number; gf: number }> = {};
    for (const t of gTeams) stats[t.id] = { pts: 0, gd: 0, gf: 0 };
    for (const m of groupMatches) {
      if (!m.played || m.score_a == null || m.score_b == null) continue;
      if (!m.team_a_id || !m.team_b_id) continue;
      const a = stats[m.team_a_id];
      const b = stats[m.team_b_id];
      if (!a || !b) continue;
      a.gf += m.score_a;
      a.gd += m.score_a - m.score_b;
      b.gf += m.score_b;
      b.gd += m.score_b - m.score_a;
      if (m.score_a > m.score_b) a.pts += 3;
      else if (m.score_b > m.score_a) b.pts += 3;
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
 * Compute the suggested team assignments for every knockout match, using
 * actual results + admin overrides. The caller is responsible for diffing
 * against the current DB values and offering an "Apply suggestion" action;
 * this function never mutates anything.
 */
export function computeAdminKnockoutAssignments(
  teams: Team[],
  matches: AdminMatchRow[],
  groupOverrides: GroupResultOverride[],
  thirdPlaceTiebreakers: TiebreakerPick[] = [],
): AdminKnockoutResult {
  const groupMatches = matches.filter((m) => m.round === "group");
  const standings = computeStandingsFromActual(teams, groupMatches);

  // Winners / runners-up per group, override-first.
  const overrideMap = new Map(groupOverrides.map((g) => [g.group_name, g]));
  const winnerOf: Record<string, string | null> = {};
  const runnerOf: Record<string, string | null> = {};
  const thirdOverrideOf: Record<string, string | null> = {};
  for (const s of standings) {
    if (s.position === 1) winnerOf[s.group_name] ??= s.team_id;
    else if (s.position === 2) runnerOf[s.group_name] ??= s.team_id;
  }
  for (const [group, ov] of overrideMap) {
    if (ov.winner_team_id) winnerOf[group] = ov.winner_team_id;
    if (ov.runner_up_team_id) runnerOf[group] = ov.runner_up_team_id;
    if (ov.third_place_team_id) thirdOverrideOf[group] = ov.third_place_team_id;
  }

  // Determine the 3rd-place team per group AFTER applying overrides. If the
  // override picks a team that was originally 2nd as winner, the team that
  // was originally 1st becomes 2nd, and the original 3rd stays 3rd — but the
  // simpler stable rule we use: 3rd is whoever's neither winner nor runner-up
  // among the top 3 by points.
  const top3ByGroup: Record<string, GroupStats[]> = {};
  for (const s of standings) {
    if (s.position <= 3) (top3ByGroup[s.group_name] ??= []).push(s);
  }
  const thirdsAdjusted: GroupStats[] = [];
  for (const [group, top3] of Object.entries(top3ByGroup)) {
    const w = winnerOf[group];
    const r = runnerOf[group];
    const forcedThirdId = thirdOverrideOf[group] ?? null;
    // If admin pinned position 3 explicitly, use that team's stats if we
    // have them in this group's standings; otherwise fall back to the
    // "neither winner nor runner-up" team from top-3.
    let third: GroupStats | undefined;
    if (forcedThirdId) {
      third = standings.find(
        (s) => s.group_name === group && s.team_id === forcedThirdId,
      );
    }
    if (!third) {
      third = top3.find((t) => t.team_id !== w && t.team_id !== r);
    }
    if (third) thirdsAdjusted.push({ ...third, position: 3 });
  }

  // Use the same ranking algorithm as the participant side, but seeded with
  // our possibly-adjusted thirds.
  const fakeStandings: GroupStats[] = [
    ...standings.filter((s) => s.position !== 3),
    ...thirdsAdjusted,
  ];
  const { qualified, cutoffTieGroups } = rankThirdPlace(
    fakeStandings,
    thirdPlaceTiebreakers,
  );
  const { assignments: best3Assignments, usedFallback: best3UsedFallback } =
    assignBest3rdSlots(qualified);

  const resolveSlot = (slot: R32Slot, slotKey: number): string | null => {
    if (slot.kind === "winner") return winnerOf[slot.group] ?? null;
    if (slot.kind === "runner") return runnerOf[slot.group] ?? null;
    return best3Assignments[slotKey]?.team_id ?? null;
  };

  // Eligible candidates per slot (for the inline picker).
  const allThirds = standings.filter((s) => s.position === 3).map((s) => s.team_id);
  const eligibleSlot = (slot: R32Slot): string[] => {
    if (slot.kind === "winner") {
      const t = winnerOf[slot.group];
      return t ? [t] : [];
    }
    if (slot.kind === "runner") {
      const t = runnerOf[slot.group];
      return t ? [t] : [];
    }
    return allThirds; // any of the 12 third-placed teams
  };

  const r32Teams: (string | null)[] = [];
  const r32Eligible: Array<[string[], string[]]> = [];
  R32_SLOTS.forEach((pair, idx) => {
    r32Teams.push(resolveSlot(pair[0], idx * 2));
    r32Teams.push(resolveSlot(pair[1], idx * 2 + 1));
    r32Eligible.push([eligibleSlot(pair[0]), eligibleSlot(pair[1])]);
  });

  // Index knockout matches by round, ordered by match_number.
  const byRound: Record<string, AdminMatchRow[]> = {};
  for (const m of matches) {
    if (m.round === "group") continue;
    (byRound[m.round] ??= []).push(m);
  }
  for (const r of Object.keys(byRound)) {
    byRound[r].sort((a, b) => a.match_number - b.match_number);
  }

  const suggestions: Record<string, SlotSuggestion> = {};
  const eligible: Record<string, { a: string[]; b: string[] }> = {};

  const r32 = byRound["round_of_32"] ?? [];
  r32.forEach((m, i) => {
    suggestions[m.id] = {
      team_a_id: r32Teams[i * 2] ?? null,
      team_b_id: r32Teams[i * 2 + 1] ?? null,
    };
    eligible[m.id] = { a: r32Eligible[i][0], b: r32Eligible[i][1] };
  });

  // Helper for actual winner from played knockout match (uses winner_id).
  const actualWinner = (m: AdminMatchRow | undefined): string | null => {
    if (!m || !m.played) return null;
    if (m.winner_id) return m.winner_id;
    if (m.score_a == null || m.score_b == null) return null;
    if (m.score_a > m.score_b) return m.team_a_id;
    if (m.score_b > m.score_a) return m.team_b_id;
    return null; // draw with no admin-picked winner yet
  };

  const chain: Array<[string, string]> = [
    ["round_of_32", "round_of_16"],
    ["round_of_16", "quarter_final"],
    ["quarter_final", "semi_final"],
    ["semi_final", "final"],
  ];
  for (const [from, to] of chain) {
    const fromMatches = byRound[from] ?? [];
    const toMatches = byRound[to] ?? [];
    const winners = fromMatches.map(actualWinner);
    toMatches.forEach((m, i) => {
      suggestions[m.id] = {
        team_a_id: winners[i * 2] ?? null,
        team_b_id: winners[i * 2 + 1] ?? null,
      };
      // Eligible = the two possible winners of each feeder match.
      const feederA = fromMatches[i * 2];
      const feederB = fromMatches[i * 2 + 1];
      eligible[m.id] = {
        a: feederA
          ? [feederA.team_a_id, feederA.team_b_id].filter(
              (x): x is string => !!x,
            )
          : [],
        b: feederB
          ? [feederB.team_a_id, feederB.team_b_id].filter(
              (x): x is string => !!x,
            )
          : [],
      };
    });
  }

  // Third-place playoff: losers of the two semi-finals.
  const semis = byRound["semi_final"] ?? [];
  const third = (byRound["third_place"] ?? [])[0];
  if (third && semis.length === 2) {
    const loserOf = (m: AdminMatchRow): string | null => {
      if (!m.played) return null;
      const w = actualWinner(m);
      if (!w) return null;
      if (m.team_a_id && m.team_a_id !== w) return m.team_a_id;
      if (m.team_b_id && m.team_b_id !== w) return m.team_b_id;
      return null;
    };
    suggestions[third.id] = {
      team_a_id: loserOf(semis[0]),
      team_b_id: loserOf(semis[1]),
    };
    eligible[third.id] = {
      a: [semis[0].team_a_id, semis[0].team_b_id].filter(
        (x): x is string => !!x,
      ),
      b: [semis[1].team_a_id, semis[1].team_b_id].filter(
        (x): x is string => !!x,
      ),
    };
  }

  return {
    suggestions,
    eligible,
    standings,
    cutoffTieGroups,
    best3UsedFallback,
  };
}