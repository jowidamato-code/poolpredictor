// Shared types and helpers for tournament prediction UI

export interface Team {
  id: string;
  name: string;
  code: string;
  group_name: string;
  strength?: number | null;
}

export interface Match {
  id: string;
  round: string;
  match_number: number;
  team_a_id: string | null;
  team_b_id: string | null;
  match_date: string | null;
  played: boolean;
}

export interface LocalPrediction {
  winner_id: string | null;
  score_a: number | null;
  score_b: number | null;
  team_through?: string | null;
}

export interface Prediction {
  id: string;
  match_id: string;
  predicted_winner_id: string | null;
  predicted_score_a: number | null;
  predicted_score_b: number | null;
  predicted_team_through?: string | null;
  locked: boolean;
}

export const ROUND_LABELS: Record<string, string> = {
  group: "Group Stage",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter_final: "Quarter Finals",
  semi_final: "Semi Finals",
  third_place: "Third Place",
  final: "Final",
};

export const KNOCKOUT_ROUNDS = [
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
] as const;

const maltaDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Malta",
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const maltaTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Malta",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatMaltaDate(iso: string | null): string {
  if (!iso) return "TBD";
  return maltaDateFmt.format(new Date(iso));
}

export function formatMaltaTime(iso: string | null): string {
  if (!iso) return "—";
  return maltaTimeFmt.format(new Date(iso));
}

export interface GroupStanding {
  team: Team;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

/** A user-supplied resolution for a group-stage tie that points→GD→GF→H2H
 *  could not break. `tieKey` is `${groupName}|${sortedTeamIds.join(",")}` and
 *  is stable across re-renders so old picks become invalid as soon as the
 *  underlying tied subset changes (e.g. the user edits a score). */
export interface GroupTiebreakerPick {
  tieKey: string;
  orderedTeamIds: string[];
}

export interface UnresolvedGroupTie {
  groupName: string;
  tieKey: string;
  teamIds: string[];
}

export function groupTieKey(groupName: string, teamIds: string[]): string {
  return `${groupName}|${[...teamIds].sort().join(",")}`;
}

interface RawStats { pts: number; gd: number; gf: number }

function buildStats(
  teamIds: string[],
  groupMatches: Match[],
  predictionsLike: Record<string, { score_a: number | null; score_b: number | null } | LocalPrediction>,
  restrictToTeams?: Set<string>,
): Record<string, RawStats> {
  const stats: Record<string, RawStats> = {};
  for (const id of teamIds) stats[id] = { pts: 0, gd: 0, gf: 0 };
  for (const m of groupMatches) {
    if (!m.team_a_id || !m.team_b_id) continue;
    if (!stats[m.team_a_id] || !stats[m.team_b_id]) continue;
    if (restrictToTeams && (!restrictToTeams.has(m.team_a_id) || !restrictToTeams.has(m.team_b_id))) continue;
    const p = predictionsLike[m.id];
    if (!p || p.score_a == null || p.score_b == null) continue;
    const a = stats[m.team_a_id], b = stats[m.team_b_id];
    a.gf += p.score_a; a.gd += p.score_a - p.score_b;
    b.gf += p.score_b; b.gd += p.score_b - p.score_a;
    if (p.score_a > p.score_b) a.pts += 3;
    else if (p.score_b > p.score_a) b.pts += 3;
    else { a.pts++; b.pts++; }
  }
  return stats;
}

function compareStats(a: RawStats, b: RawStats): number {
  return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf;
}

/**
 * Take a list of team ids already sorted by overall pts/GD/GF, and resolve
 * any runs of equal teams using FIFA tiebreakers:
 *   step 4 — H2H points
 *   step 5 — H2H goal difference
 *   step 6 — H2H goals scored
 *   step 7 — user-supplied manual order (per `GroupTiebreakerPick`)
 * Returns the refined ordering plus any runs that are still unresolved
 * after step 6 (so the UI can prompt the user).
 */
export function resolveGroupTies(
  groupName: string,
  sortedTeamIds: string[],
  overallStats: Record<string, RawStats>,
  groupMatches: Match[],
  predictionsLike: Record<string, { score_a: number | null; score_b: number | null } | LocalPrediction>,
  userPicks: GroupTiebreakerPick[] = [],
): { ordered: string[]; unresolvedTies: UnresolvedGroupTie[] } {
  const ordered: string[] = [];
  const unresolvedTies: UnresolvedGroupTie[] = [];
  const pickMap = new Map(userPicks.map((p) => [p.tieKey, p.orderedTeamIds]));

  let i = 0;
  while (i < sortedTeamIds.length) {
    let j = i + 1;
    const base = overallStats[sortedTeamIds[i]];
    while (
      j < sortedTeamIds.length &&
      compareStats(base, overallStats[sortedTeamIds[j]]) === 0
    ) j++;
    const run = sortedTeamIds.slice(i, j);
    if (run.length === 1) { ordered.push(run[0]); i = j; continue; }

    // Apply H2H within the tied subset
    const restrict = new Set(run);
    const h2hStats = buildStats(run, groupMatches, predictionsLike, restrict);
    const afterH2H = run.slice().sort((x, y) => compareStats(h2hStats[x], h2hStats[y]));

    // Walk runs that are still tied even after H2H
    let k = 0;
    while (k < afterH2H.length) {
      let l = k + 1;
      const baseH = h2hStats[afterH2H[k]];
      while (
        l < afterH2H.length &&
        compareStats(baseH, h2hStats[afterH2H[l]]) === 0
      ) l++;
      const subRun = afterH2H.slice(k, l);
      if (subRun.length === 1) { ordered.push(subRun[0]); k = l; continue; }

      const tieKey = groupTieKey(groupName, subRun);
      const pick = pickMap.get(tieKey);
      if (pick && pick.length === subRun.length && subRun.every((id) => pick.includes(id))) {
        ordered.push(...pick);
      } else {
        ordered.push(...subRun);
        unresolvedTies.push({ groupName, tieKey, teamIds: subRun });
      }
      k = l;
    }
    i = j;
  }
  return { ordered, unresolvedTies };
}

/** Compute group standings from a user's predictions for that group */
export function computeGroupStandings(
  groupTeams: Team[],
  groupMatches: Match[],
  localPredictions: Record<string, LocalPrediction>,
  userTiebreakers: GroupTiebreakerPick[] = [],
): GroupStanding[] {
  return computeGroupStandingsWithTies(groupTeams, groupMatches, localPredictions, userTiebreakers).standings;
}

export function computeGroupStandingsWithTies(
  groupTeams: Team[],
  groupMatches: Match[],
  localPredictions: Record<string, LocalPrediction>,
  userTiebreakers: GroupTiebreakerPick[] = [],
): { standings: GroupStanding[]; unresolvedTies: UnresolvedGroupTie[] } {
  const map = new Map<string, GroupStanding>();
  for (const t of groupTeams) {
    map.set(t.id, {
      team: t,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    });
  }

  for (const m of groupMatches) {
    if (!m.team_a_id || !m.team_b_id) continue;
    const pred = localPredictions[m.id];
    if (!pred || pred.score_a == null || pred.score_b == null) continue;

    const a = map.get(m.team_a_id);
    const b = map.get(m.team_b_id);
    if (!a || !b) continue;

    a.played++;
    b.played++;
    a.gf += pred.score_a;
    a.ga += pred.score_b;
    b.gf += pred.score_b;
    b.ga += pred.score_a;

    if (pred.score_a > pred.score_b) {
      a.wins++;
      b.losses++;
      a.points += 3;
    } else if (pred.score_a < pred.score_b) {
      b.wins++;
      a.losses++;
      b.points += 3;
    } else {
      a.draws++;
      b.draws++;
      a.points++;
      b.points++;
    }
  }

  const list = [...map.values()];
  for (const s of list) s.gd = s.gf - s.ga;
  list.sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf);

  // Apply H2H + user picks for tied runs
  const overallStats: Record<string, RawStats> = {};
  for (const s of list) overallStats[s.team.id] = { pts: s.points, gd: s.gd, gf: s.gf };
  const groupName = groupTeams[0]?.group_name ?? "";
  const { ordered, unresolvedTies } = resolveGroupTies(
    groupName,
    list.map((s) => s.team.id),
    overallStats,
    groupMatches,
    localPredictions,
    userTiebreakers,
  );
  const byId = new Map(list.map((s) => [s.team.id, s]));
  const reordered = ordered.map((id) => byId.get(id)!).filter(Boolean);
  return { standings: reordered, unresolvedTies };
}

export function isGroupComplete(
  groupMatches: Match[],
  localPredictions: Record<string, LocalPrediction>,
): boolean {
  return groupMatches.every((m) => {
    const p = localPredictions[m.id];
    return p && p.score_a != null && p.score_b != null;
  });
}
