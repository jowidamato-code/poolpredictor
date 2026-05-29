// Derives knockout bracket team assignments from a user's group-stage
// predictions, so the bracket populates immediately for predicting without
// waiting for the admin to assign teams to knockout fixtures.
//
// FIFA World Cup 2026 — 48 teams, 12 groups (A–L). Top 2 of each group +
// 8 best 3rd-place finishers progress to a Round of 32. The R32 pairings
// are fixed by FIFA: group winners face Best-3rd teams from a defined
// eligibility pool, with the rest a fixed map of winners vs runners-up.
// Downstream rounds chain in the official bracket order.

import type { LocalPrediction, Match, Team } from "./tournament-utils";
import { THIRD_PLACE_ALLOCATION, type Best3Slot } from "./third-place-allocation";

export interface GroupStats {
  team_id: string;
  group_name: string;
  pts: number;
  gd: number;
  gf: number;
  position: 1 | 2 | 3 | 4;
}

export interface CutoffTieGroup {
  /** Stable key derived from tied stats so old picks invalidate when scores change. */
  tieKey: string;
  /** All teams tied at this (pts,gd,gf). */
  teams: GroupStats[];
  /** How many of these tied teams should advance to fill the remaining cutoff slots. */
  slotsAvailable: number;
}

export interface TiebreakerPick {
  tieKey: string;
  /** Team IDs the user has chosen to advance from the tied group. */
  advancing: string[];
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
 * Official FIFA 2026 Round of 32 slot map, indexed by R32 match_number
 * ascending (16 entries). Each slot is either a fixed reference to a
 * group's winner/runner-up, or a "best3" pool of groups whose qualifying
 * 3rd-place team is eligible to fill the slot.
 */
type R32Slot =
  | { kind: "winner"; group: string }
  | { kind: "runner"; group: string }
  | { kind: "best3"; pool: string[] };

export type { R32Slot };
export const R32_SLOTS: Array<[R32Slot, R32Slot]> = [
  // 1: W-E vs Best 3rd (A/B/C/D/F)
  [{ kind: "winner", group: "E" }, { kind: "best3", pool: ["A", "B", "C", "D", "F"] }],
  // 2: W-F vs RU-C
  [{ kind: "winner", group: "F" }, { kind: "runner", group: "C" }],
  // 3: W-C vs RU-F
  [{ kind: "winner", group: "C" }, { kind: "runner", group: "F" }],
  // 4: W-I vs Best 3rd (C/D/F/G/H)
  [{ kind: "winner", group: "I" }, { kind: "best3", pool: ["C", "D", "F", "G", "H"] }],
  // 5: RU-E vs RU-I
  [{ kind: "runner", group: "E" }, { kind: "runner", group: "I" }],
  // 6: W-A vs Best 3rd (C/E/F/H/I)
  [{ kind: "winner", group: "A" }, { kind: "best3", pool: ["C", "E", "F", "H", "I"] }],
  // 7: W-L vs Best 3rd (E/H/I/J/K)
  [{ kind: "winner", group: "L" }, { kind: "best3", pool: ["E", "H", "I", "J", "K"] }],
  // 8: W-D vs Best 3rd (B/E/F/I/J)
  [{ kind: "winner", group: "D" }, { kind: "best3", pool: ["B", "E", "F", "I", "J"] }],
  // 9: W-G vs Best 3rd (A/E/H/I/J)
  [{ kind: "winner", group: "G" }, { kind: "best3", pool: ["A", "E", "H", "I", "J"] }],
  // 10: RU-K vs RU-L
  [{ kind: "runner", group: "K" }, { kind: "runner", group: "L" }],
  // 11: W-H vs RU-J
  [{ kind: "winner", group: "H" }, { kind: "runner", group: "J" }],
  // 12: W-B vs Best 3rd (E/F/G/I/J)
  [{ kind: "winner", group: "B" }, { kind: "best3", pool: ["E", "F", "G", "I", "J"] }],
  // 13: W-J vs RU-H
  [{ kind: "winner", group: "J" }, { kind: "runner", group: "H" }],
  // 14: RU-A vs RU-D
  [{ kind: "runner", group: "A" }, { kind: "runner", group: "D" }],
  // 15: W-K vs Best 3rd (D/E/I/J/L)
  [{ kind: "winner", group: "K" }, { kind: "best3", pool: ["D", "E", "I", "J", "L"] }],
  // 16: RU-B vs RU-G
  [{ kind: "runner", group: "B" }, { kind: "runner", group: "G" }],
];

function tieKeyFor(s: { pts: number; gd: number; gf: number }) {
  return `pts:${s.pts}|gd:${s.gd}|gf:${s.gf}`;
}

/**
 * Rank the 12 third-place finishers and select the 8 that qualify.
 * Returns the ordered qualifying list keyed by source group, plus any
 * unresolved equivalence-classes that straddle the 8/9 cutoff so the UI
 * can prompt the user.
 */
export function rankThirdPlace(
  standings: GroupStats[],
  tiebreakers: TiebreakerPick[] = [],
): {
  qualified: GroupStats[]; // length 0..8
  cutoffTieGroups: CutoffTieGroup[]; // unresolved ties at the cutoff
} {
  const thirds = standings.filter((s) => s.position === 3);
  if (thirds.length < 12) {
    // Group stage not fully predicted yet — can't qualify anyone reliably.
    return { qualified: [], cutoffTieGroups: [] };
  }

  // Sort by pts -> gd -> gf desc. Equal teams stay grouped.
  const sorted = thirds
    .slice()
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

  // Group into equivalence classes by (pts,gd,gf).
  const classes: GroupStats[][] = [];
  for (const t of sorted) {
    const last = classes[classes.length - 1];
    if (last && tieKeyFor(last[0]) === tieKeyFor(t)) last.push(t);
    else classes.push([t]);
  }

  const tbMap = new Map(tiebreakers.map((t) => [t.tieKey, t.advancing]));
  const qualified: GroupStats[] = [];
  const cutoffTieGroups: CutoffTieGroup[] = [];
  let filled = 0;

  for (const cls of classes) {
    const remaining = 8 - filled;
    if (remaining <= 0) break;
    if (cls.length <= remaining) {
      // Whole class fits — straightforward
      qualified.push(...cls);
      filled += cls.length;
      continue;
    }
    // Class straddles the cutoff — need to pick `remaining` of `cls.length`
    const key = tieKeyFor(cls[0]);
    const userPicks = tbMap.get(key) ?? [];
    const validPicks = userPicks.filter((id) => cls.some((c) => c.team_id === id));
    if (validPicks.length === remaining) {
      for (const id of validPicks) {
        const t = cls.find((c) => c.team_id === id);
        if (t) qualified.push(t);
      }
      filled += remaining;
    } else {
      cutoffTieGroups.push({ tieKey: key, teams: cls, slotsAvailable: remaining });
      // Leave the rest of the cutoff unresolved; do not pull from later classes.
      break;
    }
  }

  return { qualified, cutoffTieGroups };
}

/**
 * Assign the 8 qualified 3rd-place teams to R32 "Best 3rd" slots using the
 * official FIFA 2026 lookup table (495 combinations) keyed by the sorted
 * 8-letter group string. Falls back to the greedy pool-matching heuristic
 * if the lookup key is missing or fewer than 8 teams have qualified.
 */
// R32_SLOTS index → M-number used by the FIFA bracket (M = idx + 74).
// Best-3rd slots are always the second team in each pair, so slotKey = idx*2 + 1.
const BEST3_SLOTKEY_BY_MATCH: Record<Best3Slot, { idx: number; slotKey: number }> = {
  M74: { idx: 0, slotKey: 1 },
  M77: { idx: 3, slotKey: 7 },
  M79: { idx: 5, slotKey: 11 },
  M80: { idx: 6, slotKey: 13 },
  M81: { idx: 7, slotKey: 15 },
  M82: { idx: 8, slotKey: 17 },
  M85: { idx: 11, slotKey: 23 },
  M88: { idx: 14, slotKey: 29 },
};

function assignBest3rdSlots(qualified: GroupStats[]): {
  assignments: Record<number, GroupStats | null>;
  usedFallback: boolean;
} {
  const out: Record<number, GroupStats | null> = {};

  if (qualified.length === 8) {
    const key = qualified
      .map((q) => q.group_name)
      .slice()
      .sort()
      .join("");
    const lookup = THIRD_PLACE_ALLOCATION[key];
    if (lookup) {
      const byGroup = new Map(qualified.map((q) => [q.group_name, q]));
      for (const m of Object.keys(BEST3_SLOTKEY_BY_MATCH) as Best3Slot[]) {
        const groupLetter = lookup[m];
        out[BEST3_SLOTKEY_BY_MATCH[m].slotKey] = byGroup.get(groupLetter) ?? null;
      }
      return { assignments: out, usedFallback: false };
    }
  }

  // Fallback: greedy pool matching (used only if <8 qualifiers or key missing).
  const remaining = qualified.slice();
  R32_SLOTS.forEach((pair, idx) => {
    for (let i = 0; i < 2; i++) {
      const slot = pair[i];
      if (slot.kind !== "best3") continue;
      const slotKey = idx * 2 + i;
      const pickIdx = remaining.findIndex((q) => slot.pool.includes(q.group_name));
      if (pickIdx >= 0) {
        out[slotKey] = remaining[pickIdx];
        remaining.splice(pickIdx, 1);
      } else {
        out[slotKey] = null;
      }
    }
  });
  return { assignments: out, usedFallback: qualified.length > 0 };
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
  tiebreakers: TiebreakerPick[] = [],
): {
  assignments: Record<string, { team_a_id: string | null; team_b_id: string | null }>;
  cutoffTieGroups: CutoffTieGroup[];
  standings: GroupStats[];
  best3UsedFallback: boolean;
} {
  const out: Record<string, { team_a_id: string | null; team_b_id: string | null }> = {};
  for (const m of matches) {
    out[m.id] = { team_a_id: m.team_a_id, team_b_id: m.team_b_id };
  }

  const groupMatches = matches.filter((m) => m.round === "group");
  const standings = computeAllStandings(teams, groupMatches, predictions);

  // Winners / runners-up lookup by group letter
  const winnerOf: Record<string, string | null> = {};
  const runnerOf: Record<string, string | null> = {};
  for (const s of standings) {
    if (s.position === 1) winnerOf[s.group_name] = s.team_id;
    else if (s.position === 2) runnerOf[s.group_name] = s.team_id;
  }

  // 3rd-place qualifiers + any ambiguous cutoff ties
  const { qualified, cutoffTieGroups } = rankThirdPlace(standings, tiebreakers);
  const { assignments: best3Assignments, usedFallback: best3UsedFallback } =
    assignBest3rdSlots(qualified);

  // Resolve each R32 slot to a team id (or null if not yet derivable)
  const resolveSlot = (slot: R32Slot, slotKey: number): string | null => {
    if (slot.kind === "winner") return winnerOf[slot.group] ?? null;
    if (slot.kind === "runner") return runnerOf[slot.group] ?? null;
    return best3Assignments[slotKey]?.team_id ?? null;
  };

  const r32Teams: (string | null)[] = [];
  R32_SLOTS.forEach((pair, idx) => {
    r32Teams.push(resolveSlot(pair[0], idx * 2));
    r32Teams.push(resolveSlot(pair[1], idx * 2 + 1));
  });

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

  return { assignments: out, cutoffTieGroups, standings, best3UsedFallback };
}
