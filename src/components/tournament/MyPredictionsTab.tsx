import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Check, X, Minus, Loader2, Clock, Star, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TeamFlag } from "./TeamFlag";
import { MyGroupStandingsTab } from "./MyGroupStandingsTab";
import { formatMaltaDate, formatMaltaTime, sortKnockoutByBracket } from "@/lib/tournament-utils";
import { deriveKnockoutTeams, r32TeamSourceLabels, type TiebreakerPick } from "@/lib/knockout-derivation";
import {
  buildScoringConfig,
  scoreMatchPrediction,
  scoreBonusPrediction,
  scoreDerivedGroupStage,
  scoreDerivedProgression,
  progressionBreakdown,
  type ProgressionBreakdownEntry,
  type ScoringConfig,
} from "@/lib/scoring";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ROUND_LABELS: Record<string, string> = {
  group: "Group Stage",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter_final: "Quarter Finals",
  semi_final: "Semi Finals",
  third_place: "Third Place",
  final: "Final",
};

interface MyPredictionsTabProps {
  userId: string;
}

export function MyPredictionsTab({ userId }: MyPredictionsTabProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ScoringConfig | null>(null);
  const [bonusPred, setBonusPred] = useState<any>(null);
  const [bonusResult, setBonusResult] = useState<any>(null);
  const [verdicts, setVerdicts] = useState<any[]>([]);
  const [progressionOpen, setProgressionOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("teams").select("*").order("group_name").order("name"),
      supabase.from("matches").select("*").order("match_number"),
      supabase.from("predictions").select("*").eq("user_id", userId),
      supabase.from("settings").select("*"),
      (supabase as any).from("bonus_predictions").select("*").eq("user_id", userId).maybeSingle(),
      (supabase as any).from("bonus_results").select("*").maybeSingle(),
      (supabase as any).from("bonus_award_verdicts").select("*").eq("user_id", userId),
    ]).then(([teamsRes, matchesRes, predsRes, settingsRes, bonusPredRes, bonusResultRes, verdictsRes]) => {
      setTeams(teamsRes.data ?? []);
      setMatches(matchesRes.data ?? []);
      setPredictions(predsRes.data ?? []);
      const settingsMap = Object.fromEntries(
        (settingsRes.data ?? []).map((s: any) => [s.key, s.value]),
      );
      setConfig(buildScoringConfig(settingsMap));
      setBonusPred(bonusPredRes.data);
      setBonusResult(bonusResultRes.data);
      setVerdicts(verdictsRes.data ?? []);
      setLoading(false);
    });
  }, [userId]);

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
  const predMap = Object.fromEntries(predictions.map((p) => [p.match_id, p]));
  const rounds = [...new Set(matches.map((m) => m.round))];

  // Derive the user's predicted knockout bracket so KO cards show predicted
  // teams instead of "TBD". This mirrors how PredictionsTab/KnockoutBracketView
  // resolve teams from the user's own group-stage + KO picks.
  const localPredMap: Record<string, { score_a: number | null; score_b: number | null; team_through?: string | null }> =
    Object.fromEntries(
      predictions.map((p) => [
        p.match_id,
        {
          score_a: p.predicted_score_a,
          score_b: p.predicted_score_b,
          team_through: p.predicted_team_through ?? null,
        },
      ]),
    );
  const groupTiebreakers = Array.isArray((bonusPred as any)?.group_tiebreakers)
    ? ((bonusPred as any).group_tiebreakers as any[])
    : [];
  const thirdPlaceTiebreakers: TiebreakerPick[] = Array.isArray(
    (bonusPred as any)?.third_place_tiebreakers,
  )
    ? ((bonusPred as any).third_place_tiebreakers as TiebreakerPick[])
    : [];
  const { assignments: derivedKO } =
    teams.length && matches.length
      ? deriveKnockoutTeams(
          teams as any,
          // Strip admin-assigned KO teams so derivation reflects the user's
          // predicted bracket, not the actual matchup the admin entered.
          matches.map((m: any) =>
            m.round === "group" ? m : { ...m, team_a_id: null, team_b_id: null },
          ) as any,
          localPredMap as any,
          thirdPlaceTiebreakers,
          groupTiebreakers as any,
        )
      : { assignments: {} as Record<string, { team_a_id: string | null; team_b_id: string | null }> };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="py-20 text-center">
        <Trophy className="mx-auto h-16 w-16 text-muted-foreground/30" />
        <h3 className="mt-4 text-xl font-semibold text-foreground">No Predictions Yet</h3>
        <p className="mt-2 text-muted-foreground">
          Go to the Predictions tab to submit your picks!
        </p>
      </div>
    );
  }

  const lastUpdated = predictions.reduce<string | null>((latest, p) => {
    const t = p.updated_at ?? p.created_at;
    if (!t) return latest;
    if (!latest || new Date(t) > new Date(latest)) return t;
    return latest;
  }, null);

  // Points breakdown (matches Standings calculation)
  let matchPts = 0;
  let groupPts = 0;
  let progressionPts = 0;
  let bonusPts = 0;
  let progressionEntries: ProgressionBreakdownEntry[] = [];
  if (config) {
    for (const pred of predictions) {
      const m = matches.find((x) => x.id === pred.match_id);
      if (m && m.played) {
        const slot = derivedKO[m.id];
        matchPts += scoreMatchPrediction(
          m as any,
          pred as any,
          config,
          slot?.team_a_id ?? m.team_a_id,
          slot?.team_b_id ?? m.team_b_id,
        );
      }
    }
    groupPts = scoreDerivedGroupStage(
      teams as any,
      matches as any,
      predictions as any,
      config,
      undefined,
      Array.isArray((bonusPred as any)?.group_tiebreakers)
        ? ((bonusPred as any).group_tiebreakers as any[])
        : [],
    );
    const pb = progressionBreakdown(
      teams as any,
      matches as any,
      predictions as any,
      config,
      thirdPlaceTiebreakers,
      groupTiebreakers as any,
    );
    progressionPts = pb.total;
    progressionEntries = pb.entries;
    if (bonusPred && bonusResult) {
      const verdictMap: any = {};
      for (const v of verdicts) verdictMap[v.award] = v.verdict;
      bonusPts = scoreBonusPrediction(bonusPred, bonusResult, config, verdictMap);
    }
  }
  const totalPts = matchPts + groupPts + progressionPts + bonusPts;

  const AWARDS: { key: "top_scorer" | "golden_ball" | "young_player" | "most_assists"; label: string; pointsKey: keyof ScoringConfig }[] = [
    { key: "top_scorer", label: "Top Scorer", pointsKey: "top_scorer" },
    { key: "golden_ball", label: "Golden Ball", pointsKey: "golden_ball" },
    { key: "young_player", label: "Young Player", pointsKey: "young_player" },
    { key: "most_assists", label: "Most Assists", pointsKey: "most_assists" },
  ];
  const verdictByAward: Record<string, "won" | "lost" | undefined> = {};
  for (const v of verdicts) verdictByAward[v.award] = v.verdict;

  const tabValues = [...rounds];
  if (tabValues[0] === "group") {
    tabValues.splice(1, 0, "group_standings");
  } else {
    tabValues.push("group_standings");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Points Breakdown</h3>
          <Badge className="text-base font-bold">{totalPts} pts</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="text-muted-foreground">Match results</div>
            <div className="text-base font-bold text-foreground">{matchPts}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="text-muted-foreground">Group winners/runners-up</div>
            <div className="text-base font-bold text-foreground">{groupPts}</div>
          </div>
          <button
            type="button"
            onClick={() => setProgressionOpen(true)}
            className="rounded-md border border-border bg-muted/30 px-3 py-2 text-left transition hover:bg-muted/50 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <div className="text-muted-foreground flex items-center gap-1">
              Knockout progression
              <ChevronDown className="h-3 w-3 -rotate-90 opacity-60" />
            </div>
            <div className="text-base font-bold text-foreground">{progressionPts}</div>
          </button>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="text-muted-foreground">Player awards</div>
            <div className="text-base font-bold text-foreground">{bonusPts}</div>
          </div>
        </div>
      </div>
      {lastUpdated && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>
            Last submitted:{" "}
            <span className="font-medium text-foreground">
              {formatMaltaDate(lastUpdated)} · {formatMaltaTime(lastUpdated)} MLT
            </span>
          </span>
        </div>
      )}
      <Tabs defaultValue={rounds[0]} className="space-y-4">
      <div className="-mx-1 overflow-x-auto pb-1">
        <TabsList className="inline-flex w-max gap-1">
          {tabValues.map((value) => (
            <TabsTrigger key={value} value={value} className="text-[11px] sm:text-xs whitespace-nowrap px-2.5">
              {value === "group_standings" ? "Group Standings" : ROUND_LABELS[value] ?? value}
            </TabsTrigger>
          ))}
          {bonusPred && (
            <TabsTrigger value="player_awards" className="text-[11px] sm:text-xs whitespace-nowrap px-2.5">
              Player Awards
            </TabsTrigger>
          )}
        </TabsList>
      </div>

      {rounds.map((round) => (
        <TabsContent key={round} value={round} className="space-y-3">
          {(() => {
            const roundMatches =
              round === "group"
                ? matches.filter((m) => m.round === round)
                : sortKnockoutByBracket(matches.filter((m) => m.round === round));
            const renderMatch = (match: any) => {
              const isKO = match.round !== "group";
              const derived = derivedKO[match.id];
              // Predicted teams: for KO use the user's derived bracket, falling
              // back to whatever is on the match row.
              const predTeamAId = isKO
                ? (derived?.team_a_id ?? match.team_a_id)
                : match.team_a_id;
              const predTeamBId = isKO
                ? (derived?.team_b_id ?? match.team_b_id)
                : match.team_b_id;
              const teamA = predTeamAId ? teamMap[predTeamAId] : null;
              const teamB = predTeamBId ? teamMap[predTeamBId] : null;
              // Actual teams come straight from the match record.
              const actualTeamA = match.team_a_id ? teamMap[match.team_a_id] : null;
              const actualTeamB = match.team_b_id ? teamMap[match.team_b_id] : null;
              const r32Labels =
                round === "round_of_32"
                  ? r32TeamSourceLabels(match.match_number, teamA, teamB)
                  : null;
              const actualR32Labels =
                round === "round_of_32"
                  ? r32TeamSourceLabels(match.match_number, actualTeamA, actualTeamB)
                  : null;
              const pred = predMap[match.id];

              const hasResult = match.played;

              // KO draw advancing-team info (visual only)
              const predIsDraw =
                isKO &&
                pred?.predicted_score_a != null &&
                pred?.predicted_score_b != null &&
                pred.predicted_score_a === pred.predicted_score_b;
              const predThroughId = predIsDraw ? (pred?.predicted_team_through ?? null) : null;
              const predThroughTeam = predThroughId ? teamMap[predThroughId] : null;
              const actualIsDraw =
                isKO &&
                hasResult &&
                match.score_a != null &&
                match.score_b != null &&
                match.score_a === match.score_b;
              const actualThroughId = actualIsDraw ? (match.winner_id ?? null) : null;
              const actualThroughTeam = actualThroughId ? teamMap[actualThroughId] : null;
              const throughMatch =
                predThroughId && actualThroughId ? predThroughId === actualThroughId : null;

              // Compute detailed result categories
              let resultKind: "exact" | "gd" | "winner" | "wrong" | null = null;
              let bttsCorrect: boolean | null = null;
              let pointsEarned = 0;
              if (hasResult && pred && pred.predicted_score_a != null && pred.predicted_score_b != null && match.score_a != null && match.score_b != null) {
                const actualWinner =
                  match.score_a > match.score_b ? match.team_a_id
                    : match.score_b > match.score_a ? match.team_b_id
                    : null;
                const predictedWinner =
                  pred.predicted_score_a > pred.predicted_score_b ? match.team_a_id
                    : pred.predicted_score_b > pred.predicted_score_a ? match.team_b_id
                    : null;
                const winnerCorrect = actualWinner === predictedWinner;
                const exactScore = pred.predicted_score_a === match.score_a && pred.predicted_score_b === match.score_b;
                const gdCorrect = (match.score_a - match.score_b) === (pred.predicted_score_a - pred.predicted_score_b);
                if (exactScore) resultKind = "exact";
                else if (winnerCorrect && gdCorrect) resultKind = "gd";
                else if (winnerCorrect) resultKind = "winner";
                else resultKind = "wrong";

                const actualBtts = match.score_a > 0 && match.score_b > 0;
                const predBtts = pred.predicted_score_a > 0 && pred.predicted_score_b > 0;
                bttsCorrect = actualBtts === predBtts;

                if (config) {
                  const slot = derivedKO[match.id];
                  pointsEarned = scoreMatchPrediction(
                    match as any,
                    pred as any,
                    config,
                    slot?.team_a_id ?? match.team_a_id,
                    slot?.team_b_id ?? match.team_b_id,
                  );
                }
              }

              return (
                <Card
                  key={match.id}
                  className={`border-border bg-card ${resultKind === "exact" ? "border-primary/40" : ""}`}
                >
                  <CardContent className="p-2.5 sm:p-4 space-y-2">
                    <div className="flex items-center gap-1.5 sm:gap-4">
                      <div className="text-[10px] sm:text-xs font-medium text-muted-foreground w-14 sm:w-20 shrink-0 leading-tight">
                        <div className="text-center">#{match.match_number}</div>
                        {isKO && match.match_date && (
                          <div className="text-[9px] sm:text-[10px] text-muted-foreground/80 text-center">
                            {formatMaltaDate(match.match_date)}
                            <br />
                            {formatMaltaTime(match.match_date)} MLT
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2 min-w-0">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-right text-[11px] sm:text-sm font-medium text-foreground">
                            {teamA?.name ?? "TBD"}
                          </span>
                          {r32Labels?.a && (
                            <span className="truncate text-right text-[10px] text-muted-foreground/80">
                              {r32Labels.a}
                            </span>
                          )}
                        </div>
                        <TeamFlag code={teamA?.code} name={teamA?.name} size={18} />
                      </div>
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className="flex items-center gap-0.5 sm:gap-2">
                          <span className="h-7 w-8 sm:h-10 sm:w-14 flex items-center justify-center text-sm sm:text-lg font-bold text-foreground bg-muted rounded-md ring-1 ring-border">
                            {pred?.predicted_score_a ?? "-"}
                          </span>
                          <span className="text-muted-foreground font-bold text-xs sm:text-base">:</span>
                          <span className="h-7 w-8 sm:h-10 sm:w-14 flex items-center justify-center text-sm sm:text-lg font-bold text-foreground bg-muted rounded-md ring-1 ring-border">
                            {pred?.predicted_score_b ?? "-"}
                          </span>
                        </div>
                        <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
                          Your pick
                        </span>
                        {predIsDraw && predThroughTeam && (
                          <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground">
                            <span>→</span>
                            <TeamFlag code={predThroughTeam.code} name={predThroughTeam.name} size={12} />
                            <span className="font-semibold text-foreground">
                              {predThroughTeam.code ?? predThroughTeam.name}
                            </span>
                            <span>to advance</span>
                            {throughMatch === true && <Check className="h-3 w-3 text-primary" />}
                            {throughMatch === false && <X className="h-3 w-3 text-destructive" />}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 items-center gap-1 sm:gap-2 min-w-0">
                        <TeamFlag code={teamB?.code} name={teamB?.name} size={18} />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-[11px] sm:text-sm font-medium text-foreground">
                            {teamB?.name ?? "TBD"}
                          </span>
                          {r32Labels?.b && (
                            <span className="truncate text-[10px] text-muted-foreground/80">
                              {r32Labels.b}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {hasResult && (
                      <div className="flex items-center gap-1.5 sm:gap-4 pt-1 border-t border-border/50">
                        <div className="text-[10px] sm:text-xs font-medium text-primary w-5 sm:w-8 text-center shrink-0">
                          Actual
                        </div>
                        <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2 min-w-0">
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-right text-[11px] sm:text-sm font-medium text-foreground">
                              {actualTeamA?.name ?? "TBD"}
                            </span>
                            {actualR32Labels?.a && (
                              <span className="truncate text-right text-[10px] text-muted-foreground/80">
                                {actualR32Labels.a}
                              </span>
                            )}
                          </div>
                          <TeamFlag code={actualTeamA?.code} name={actualTeamA?.name} size={18} />
                        </div>
                        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
                          <span className="h-7 w-8 sm:h-10 sm:w-14 flex items-center justify-center text-sm sm:text-lg font-bold text-primary bg-primary/10 rounded-md ring-1 ring-primary/40">
                            {match.score_a}
                          </span>
                          <span className="text-primary font-bold text-xs sm:text-base">:</span>
                          <span className="h-7 w-8 sm:h-10 sm:w-14 flex items-center justify-center text-sm sm:text-lg font-bold text-primary bg-primary/10 rounded-md ring-1 ring-primary/40">
                            {match.score_b}
                          </span>
                        </div>
                        <div className="flex flex-1 items-center gap-1 sm:gap-2 min-w-0">
                          <TeamFlag code={actualTeamB?.code} name={actualTeamB?.name} size={18} />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-[11px] sm:text-sm font-medium text-foreground">
                              {actualTeamB?.name ?? "TBD"}
                            </span>
                            {actualR32Labels?.b && (
                              <span className="truncate text-[10px] text-muted-foreground/80">
                                {actualR32Labels.b}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {actualIsDraw && actualThroughTeam && (
                      <div className="flex items-center justify-center gap-1 text-[9px] sm:text-[10px] text-primary">
                        <span>→</span>
                        <TeamFlag code={actualThroughTeam.code} name={actualThroughTeam.name} size={12} />
                        <span className="font-semibold">
                          {actualThroughTeam.code ?? actualThroughTeam.name}
                        </span>
                        <span>advanced</span>
                      </div>
                    )}
                    {hasResult && (
                      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-border/50">
                        <div className="flex items-center gap-1 flex-wrap">
                          {resultKind === "exact" && (
                            <Badge className="bg-primary/20 text-primary text-[10px] sm:text-xs h-5 px-1.5">
                              <Check className="mr-0.5 h-3 w-3" /> Exact
                            </Badge>
                          )}
                          {resultKind === "gd" && (
                            <Badge variant="secondary" className="text-[10px] sm:text-xs h-5 px-1.5">
                              <Check className="mr-0.5 h-3 w-3" /> Result + GD
                            </Badge>
                          )}
                          {resultKind === "winner" && (
                            <Badge variant="secondary" className="text-[10px] sm:text-xs h-5 px-1.5">
                              <Check className="mr-0.5 h-3 w-3" /> Result
                            </Badge>
                          )}
                          {resultKind === "wrong" && (
                            <Badge variant="outline" className="text-[10px] sm:text-xs h-5 px-1.5 text-muted-foreground">
                              <X className="mr-0.5 h-3 w-3" /> Wrong
                            </Badge>
                          )}
                          {bttsCorrect !== null && (
                            bttsCorrect ? (
                              <Badge variant="outline" className="text-[10px] sm:text-xs h-5 px-1.5 border-primary/40 text-primary">
                                <Check className="mr-0.5 h-3 w-3" /> BTTS
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] sm:text-xs h-5 px-1.5 text-muted-foreground">
                                <X className="mr-0.5 h-3 w-3" /> BTTS
                              </Badge>
                            )
                          )}
                        </div>
                        <Badge variant={pointsEarned > 0 ? "default" : "outline"} className="text-[10px] sm:text-xs h-5 px-1.5 font-bold">
                          +{pointsEarned} pts
                        </Badge>
                      </div>
                    )}
                    {!hasResult && pred && (
                      <div className="flex justify-end">
                        <Badge variant="outline" className="text-[10px] sm:text-xs h-5 px-1.5">
                          <Minus className="mr-0.5 h-3 w-3" /> Pending
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                  {pred && (
                    <div className="flex items-center gap-1.5 border-t border-border px-4 py-1.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Submitted {formatMaltaDate(pred.updated_at ?? pred.created_at)} ·{" "}
                      {formatMaltaTime(pred.updated_at ?? pred.created_at)} MLT
                    </div>
                  )}
                </Card>
              );
            };

            if (round !== "group") {
              return <>{roundMatches.map(renderMatch)}</>;
            }


            const upcoming = roundMatches
              .filter((m) => !m.played)
              .sort((a, b) => {
                if (!a.match_date && !b.match_date) return a.match_number - b.match_number;
                if (!a.match_date) return 1;
                if (!b.match_date) return -1;
                const d = new Date(a.match_date).getTime() - new Date(b.match_date).getTime();
                return d !== 0 ? d : a.match_number - b.match_number;
              });
            const finished = roundMatches
              .filter((m) => m.played)
              .sort((a, b) => {
                if (!a.match_date && !b.match_date) return b.match_number - a.match_number;
                if (!a.match_date) return 1;
                if (!b.match_date) return -1;
                const d = new Date(b.match_date).getTime() - new Date(a.match_date).getTime();
                return d !== 0 ? d : b.match_number - a.match_number;
              });

            return (
              <div className="space-y-3">
                <Collapsible>
                  <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:bg-muted/40">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Clock className="h-4 w-4 text-primary" />
                      Upcoming Events
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {upcoming.length}
                      </Badge>
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    {upcoming.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                        No upcoming matches.
                      </p>
                    ) : (
                      upcoming.map(renderMatch)
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible>
                  <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:bg-muted/40">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Check className="h-4 w-4 text-primary" />
                      Finished Events
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {finished.length}
                      </Badge>
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    {finished.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                        No finished matches yet.
                      </p>
                    ) : (
                      finished.map(renderMatch)
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })()}
        </TabsContent>
      ))}

      <TabsContent value="group_standings" className="space-y-3">
        <MyGroupStandingsTab userId={userId} />
      </TabsContent>

      {bonusPred && (
        <TabsContent value="player_awards" className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-foreground">Player Awards</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
            {AWARDS.map((a) => {
              const pick = (bonusPred as any)[a.key] as string | null | undefined;
              const official = (bonusResult as any)?.[a.key] as string | null | undefined;
              const verdict = verdictByAward[a.key];
              const points = config ? (config[a.pointsKey] as number) : 0;
              const earned =
                verdict === "won"
                  ? points
                  : verdict === "lost"
                    ? 0
                    : official && pick && pick.trim().toLowerCase() === official.trim().toLowerCase()
                      ? points
                      : 0;
              const decided = verdict || official;
              return (
                <div key={a.key} className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{a.label}</span>
                    {decided ? (
                      earned > 0 ? (
                        <Badge className="bg-primary/20 text-primary text-xs">
                          <Check className="mr-1 h-3 w-3" /> +{earned} pts
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          <X className="mr-1 h-3 w-3" /> 0 pts
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <Minus className="mr-1 h-3 w-3" /> Pending
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-foreground">
                    {pick || <span className="text-muted-foreground font-normal">No pick</span>}
                  </div>
                  {official && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Actual: <span className="text-foreground">{official}</span>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        </TabsContent>
      )}
      </Tabs>
      <Dialog open={progressionOpen} onOpenChange={setProgressionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Knockout Progression — {progressionPts} pts</DialogTitle>
          </DialogHeader>
          {progressionEntries.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No progression points yet. Points are awarded once your predicted
              teams actually reach each knockout round.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {progressionEntries.map((e, i) => {
                const t = teamMap[e.team_id];
                const roundLabel =
                  e.round === "champion" ? "Champion" : ROUND_LABELS[e.round] ?? e.round;
                return (
                  <li key={`${e.team_id}-${e.round}-${i}`} className="flex items-center gap-3 py-2">
                    {t && <TeamFlag teamName={t.name} flagUrl={t.flag_url} size="sm" />}
                    <div className="flex-1 min-w-0 text-sm">
                      <span className="font-medium text-foreground">{t?.name ?? "—"}</span>
                      <span className="text-muted-foreground"> → {roundLabel}</span>
                    </div>
                    <Badge className="text-xs">+{e.points}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
