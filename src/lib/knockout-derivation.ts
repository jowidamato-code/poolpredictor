// Derives knockout bracket team assignments from a user's group-stage
// predictions, so the bracket populates immediately for predicting without
// waiting for the admin to assign teams to knockout fixtures.
//
// FIFA World Cup 2026 — 48 teams, 12 groups (A–L). Top 2 of each group +
// 8 best 3rd-place finishers progress to a Round of 32. The R32 pairings
// are fixed by FIFA: group winners face Best-3rd teams from a defined
// eligibility pool, with the rest a fixed map of winners vs runners-up.
// Downstream rounds chain in the official bracket order.

import type {
  GroupTiebreakerPick,
  LocalPrediction,
  Match,
  Team,
  UnresolvedGroupTie,
} from "./tournament-utils";
import { resolveGroupTies } from "./tournament-utils";
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
  groupTiebreakers: GroupTiebreakerPick[] = [],
): { standings: GroupStats[]; unresolvedTies: UnresolvedGroupTie[] } {
  const byGroup: Record<string, Team[]> = {};
  for (const t of teams) (byGroup[t.group_name] ??= []).push(t);

  const result: GroupStats[] = [];
  const allUnresolved: UnresolvedGroupTie[] = [];
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
    const initial = gTeams.slice().sort((x, y) => {
      const sx = stats[x.id], sy = stats[y.id];
      return sy.pts - sx.pts || sy.gd - sx.gd || sy.gf - sx.gf;
    });
    const { ordered, unresolvedTies } = resolveGroupTies(
      group,
      initial.map((t) => t.id),
      stats,
      gMatches,
      predictions,
      groupTiebreakers,
    );
    allUnresolved.push(...unresolvedTies);
    const byId = new Map(gTeams.map((t) => [t.id, t]));
    const sorted = ordered.map((id) => byId.get(id)!).filter(Boolean);
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
  return { standings: result, unresolvedTies: allUnresolved };
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
  // M73: RU-A vs RU-B
  [{ kind: "runner", group: "A" }, { kind: "runner", group: "B" }],
  // M74: W-E vs Best 3rd (A/B/C/D/F)
  [{ kind: "winner", group: "E" }, { kind: "best3", pool: ["A", "B", "C", "D", "F"] }],
  // M75: W-F vs RU-C
  [{ kind: "winner", group: "F" }, { kind: "runner", group: "C" }],
  // M76: W-C vs RU-F
  [{ kind: "winner", group: "C" }, { kind: "runner", group: "F" }],
  // M77: W-I vs Best 3rd (C/D/F/G/H)
  [{ kind: "winner", group: "I" }, { kind: "best3", pool: ["C", "D", "F", "G", "H"] }],
  // M78: RU-E vs RU-I
  [{ kind: "runner", group: "E" }, { kind: "runner", group: "I" }],
  // M79: W-A vs Best 3rd (C/E/F/H/I)
  [{ kind: "winner", group: "A" }, { kind: "best3", pool: ["C", "E", "F", "H", "I"] }],
  // M80: W-L vs Best 3rd (E/H/I/J/K)
  [{ kind: "winner", group: "L" }, { kind: "best3", pool: ["E", "H", "I", "J", "K"] }],
  // M81: W-D vs Best 3rd (B/E/F/I/J)
  [{ kind: "winner", group: "D" }, { kind: "best3", pool: ["B", "E", "F", "I", "J"] }],
  // M82: W-G vs Best 3rd (A/E/H/I/J)
  [{ kind: "winner", group: "G" }, { kind: "best3", pool: ["A", "E", "H", "I", "J"] }],
  // M83: RU-K vs RU-L
  [{ kind: "runner", group: "K" }, { kind: "runner", group: "L" }],
  // M84: W-H vs RU-J
  [{ kind: "winner", group: "H" }, { kind: "runner", group: "J" }],
  // M85: W-B vs Best 3rd (E/F/G/I/J)
  [{ kind: "winner", group: "B" }, { kind: "best3", pool: ["E", "F", "G", "I", "J"] }],
  // M86: W-J vs RU-H
  [{ kind: "winner", group: "J" }, { kind: "runner", group: "H" }],
  // M87: W-K vs Best 3rd (D/E/I/J/L)
  [{ kind: "winner", group: "K" }, { kind: "best3", pool: ["D", "E", "I", "J", "L"] }],
  // M88: RU-D vs RU-G
  [{ kind: "runner", group: "D" }, { kind: "runner", group: "G" }],
];

function slotLabel(slot: R32Slot): string {
  if (slot.kind === "winner") return `1${slot.group}`;
  if (slot.kind === "runner") return `2${slot.group}`;
  return "Best 3rd";
}

function slotSourceLabel(slot: R32Slot, team: Team | null): string | null {
  if (slot.kind === "winner") return `1${slot.group}`;
  if (slot.kind === "runner") return `2${slot.group}`;
  if (team?.group_name) return `3${team.group_name}`;
  return null;
}

/** R32 source-group label, e.g. M75 → { a: "1F", b: "2C" }.
 *  Returns null if matchNumber isn't a valid R32 match. */
export function r32GroupLabel(matchNumber: number): { a: string; b: string } | null {
  const idx = matchNumber - 73;
  if (idx < 0 || idx >= R32_SLOTS.length) return null;
  const [a, b] = R32_SLOTS[idx];
  return { a: slotLabel(a), b: slotLabel(b) };
}

/** Per-team R32 source label, e.g. M74 → { a: "1E", b: "3C" }.
 *  For fixed winner/runner slots the label is the slot reference. For Best-3rd
 *  slots the label is the actual group's letter (3C, 3F, etc.) when the team is
 *  known, and null when it is still TBD. */
export function r32TeamSourceLabels(
  matchNumber: number,
  teamA: Team | null,
  teamB: Team | null,
): { a: string | null; b: string | null } | null {
  const idx = matchNumber - 73;
  if (idx < 0 || idx >= R32_SLOTS.length) return null;
  const [slotA, slotB] = R32_SLOTS[idx];
  return { a: slotSourceLabel(slotA, teamA), b: slotSourceLabel(slotB, teamB) };
}


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
export const BEST3_SLOTKEY_BY_MATCH: Record<Best3Slot, { idx: number; slotKey: number }> = {
  M74: { idx: 1, slotKey: 3 },
  M77: { idx: 4, slotKey: 9 },
  M79: { idx: 6, slotKey: 13 },
  M80: { idx: 7, slotKey: 15 },
  M81: { idx: 8, slotKey: 17 },
  M82: { idx: 9, slotKey: 19 },
  M85: { idx: 12, slotKey: 25 },
  M87: { idx: 14, slotKey: 29 },
};

export function assignBest3rdSlots(qualified: GroupStats[]): {
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
  groupTiebreakers: GroupTiebreakerPick[] = [],
): {
  assignments: Record<string, { team_a_id: string | null; team_b_id: string | null }>;
  cutoffTieGroups: CutoffTieGroup[];
  standings: GroupStats[];
  best3UsedFallback: boolean;
  unresolvedGroupTies: UnresolvedGroupTie[];
} {
  const out: Record<string, { team_a_id: string | null; team_b_id: string | null }> = {};
  for (const m of matches) {
    out[m.id] = { team_a_id: m.team_a_id, team_b_id: m.team_b_id };
  }

  const groupMatches = matches.filter((m) => m.round === "group");
  const { standings, unresolvedTies: unresolvedGroupTies } = computeAllStandings(
    teams,
    groupMatches,
    predictions,
    groupTiebreakers,
  );

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

  // Explicit FIFA 2026 bracket maps (non-sequential past R32).
  // Each entry maps a downstream match_number to the two source match_numbers
  // whose winners feed its team_a / team_b slots.
  const ROUND_SOURCES: Record<string, Record<number, [number, number]>> = {
    round_of_16: {
      89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80],
      93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
    },
    quarter_final: {
      97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
    },
    semi_final: {
      101: [97, 98], 102: [99, 100],
    },
    final: {
      104: [101, 102],
    },
  };

  // Build a lookup by match_number across all rounds we already filled.
  const byNumber: Record<number, Match> = {};
  for (const m of matches) byNumber[m.match_number] = m;

  const resolveWinner = (matchNumber: number): string | null => {
    const src = byNumber[matchNumber];
    if (!src) return null;
    return predictedWinner(src);
  };

  for (const round of ["round_of_16", "quarter_final", "semi_final", "final"] as const) {
    const sources = ROUND_SOURCES[round];
    for (const m of byRound[round] ?? []) {
      const pair = sources[m.match_number];
      if (!pair) continue;
      if (!out[m.id].team_a_id) out[m.id].team_a_id = resolveWinner(pair[0]);
      if (!out[m.id].team_b_id) out[m.id].team_b_id = resolveWinner(pair[1]);
    }
  }

  // Third-place: losers of the two semi-finals (M101, M102).
  const third = (byRound["third_place"] ?? [])[0];
  if (third) {
    const loserOf = (matchNumber: number): string | null => {
      const m = byNumber[matchNumber];
      if (!m) return null;
      const p = predictions[m.id];
      const a = out[m.id].team_a_id;
      const b = out[m.id].team_b_id;
      if (!a || !b || !p || p.score_a == null || p.score_b == null) return null;
      if (p.score_a > p.score_b) return b;
      if (p.score_b > p.score_a) return a;
      return p.team_through === a ? b : p.team_through === b ? a : null;
    };
    if (!out[third.id].team_a_id) out[third.id].team_a_id = loserOf(101);
    if (!out[third.id].team_b_id) out[third.id].team_b_id = loserOf(102);
  }

  return {
    assignments: out,
    cutoffTieGroups,
    standings,
    best3UsedFallback,
    unresolvedGroupTies,
  };
}
