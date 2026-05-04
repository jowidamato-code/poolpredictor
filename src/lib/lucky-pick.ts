// Generates a plausible scoreline from two team "strength" ratings (1–100).
// Stronger teams are favoured to win and to score more. We avoid silly upsets
// (e.g. a strength-30 team beating a strength-90 team) by weighting the dice.

export interface LuckyPickResult {
  score_a: number;
  score_b: number;
  // For knockout draws: the team id chosen to advance (favourite). null when not needed.
  team_through: string | null;
}

function clampStrength(s: number | null | undefined): number {
  if (s == null || Number.isNaN(s)) return 50;
  return Math.max(1, Math.min(100, s));
}

// Win probability for team A using a logistic on strength delta.
// Delta of 0 → 50%, delta of +20 → ~73%, delta of +40 → ~88%, delta of +60 → ~95%.
function winProbA(strA: number, strB: number): number {
  const delta = strA - strB;
  return 1 / (1 + Math.exp(-delta / 15));
}

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Pick a winning scoreline (winner score >= loser score, not equal).
// Bigger strength gap → bigger margin more likely.
function pickWinScore(strongerStr: number, weakerStr: number): [number, number] {
  const gap = strongerStr - weakerStr; // 0..99
  // Candidate (winner, loser) tuples
  const candidates: Array<[number, number]> = [
    [1, 0],
    [2, 0],
    [2, 1],
    [3, 0],
    [3, 1],
    [3, 2],
    [4, 1],
    [4, 2],
    [5, 1],
  ];
  // Weight: prefer 1-0 / 2-1 in tight matches; suppress narrow margins as the
  // gap grows so blowouts become realistic. By gap=45 we want margin >= 2 with
  // margin 3 most likely; by gap=60+ margins of 3-4 dominate.
  const weights = candidates.map(([w, l]) => {
    const margin = w - l;
    let weight: number;
    if (margin === 1) {
      // Heavily discourage 1-goal wins as gap grows (≈0 by gap 40+)
      weight = Math.max(0.5, 40 - gap * 1.0);
    } else if (margin === 2) {
      // Peaks around gap 25-40, then tapers as 3-goal margins take over
      weight = 20 + gap * 0.4 - Math.max(0, gap - 40) * 0.5;
    } else if (margin === 3) {
      // Becomes the dominant choice around gap 40-60
      weight = 5 + gap * 0.6;
    } else {
      // 4+ goal margins — kick in for very large gaps
      weight = Math.max(1, gap * 0.4 - 8);
    }
    // Slight preference for low totals when both teams weak
    const totalGoals = w + l;
    if (strongerStr < 50 && totalGoals > 3) weight *= 0.6;
    return Math.max(0.5, weight);
  });
  return pickWeighted(candidates, weights);
}

function pickDrawScore(): [number, number] {
  const draws: Array<[number, number]> = [[0, 0], [1, 1], [2, 2], [3, 3]];
  const weights = [25, 45, 22, 8];
  return pickWeighted(draws, weights);
}

export interface LuckyPickInput {
  teamAId: string;
  teamBId: string;
  strengthA: number | null | undefined;
  strengthB: number | null | undefined;
  // Group stage allows draws; knockout we still allow draws + auto-pick winner via team_through.
  allowDraw: boolean;
}

export function luckyPick(input: LuckyPickInput): LuckyPickResult {
  const sA = clampStrength(input.strengthA);
  const sB = clampStrength(input.strengthB);
  const pA = winProbA(sA, sB);
  const pB = 1 - pA;

  // Draw probability — only meaningful when teams are genuinely close in strength.
  // Closeness drops to 0 once the gap exceeds ~20 points, so mismatched fixtures
  // (e.g. 92 vs 61) almost never draw.
  // Max ~22% for evenly matched, ~2% for a 20+ point gap.
  const closeness = 1 - Math.min(1, Math.abs(sA - sB) / 20);
  const pDraw = input.allowDraw ? 0.02 + 0.20 * closeness : 0;

  const r = Math.random();
  let outcome: "A" | "B" | "draw";
  if (r < pDraw) outcome = "draw";
  else {
    // Re-normalise A vs B over remaining mass
    const remaining = 1 - pDraw;
    const aShare = pA * remaining; // = pA when no draw allowed
    outcome = r < pDraw + aShare ? "A" : "B";
  }

  if (outcome === "draw") {
    const [a, b] = pickDrawScore();
    // For knockout where draw isn't really "allowed" we still return one but
    // also pick a team_through (the favourite, with a small chance of upset).
    const favourite = sA >= sB ? input.teamAId : input.teamBId;
    const underdog = favourite === input.teamAId ? input.teamBId : input.teamAId;
    // 80% favourite, 20% underdog when very close, scaling down with gap
    const upsetProb = 0.05 + 0.15 * closeness;
    const through = Math.random() < upsetProb ? underdog : favourite;
    return { score_a: a, score_b: b, team_through: through };
  }

  if (outcome === "A") {
    const [w, l] = pickWinScore(sA, sB);
    return { score_a: w, score_b: l, team_through: null };
  }
  const [w, l] = pickWinScore(sB, sA);
  return { score_a: l, score_b: w, team_through: null };
}
