import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Check, X, Minus, Loader2, Clock, Star } from "lucide-react";
import { TeamFlag } from "./TeamFlag";
import { formatMaltaDate, formatMaltaTime } from "@/lib/tournament-utils";
import {
  buildScoringConfig,
  scoreMatchPrediction,
  scoreBonusPrediction,
  scoreDerivedGroupStage,
  scoreDerivedProgression,
  type ScoringConfig,
} from "@/lib/scoring";

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
  if (config) {
    for (const pred of predictions) {
      const m = matches.find((x) => x.id === pred.match_id);
      if (m && m.played) matchPts += scoreMatchPrediction(m as any, pred as any, config);
    }
    groupPts = scoreDerivedGroupStage(teams as any, matches as any, predictions as any, config);
    progressionPts = scoreDerivedProgression(matches as any, predictions as any, config);
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
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="text-muted-foreground">Knockout progression</div>
            <div className="text-base font-bold text-foreground">{progressionPts}</div>
          </div>
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
          {rounds.map((round) => (
            <TabsTrigger key={round} value={round} className="text-[11px] sm:text-xs whitespace-nowrap px-2.5">
              {ROUND_LABELS[round] ?? round}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {rounds.map((round) => (
        <TabsContent key={round} value={round} className="space-y-3">
          {matches
            .filter((m) => m.round === round)
            .map((match) => {
              const teamA = match.team_a_id ? teamMap[match.team_a_id] : null;
              const teamB = match.team_b_id ? teamMap[match.team_b_id] : null;
              const pred = predMap[match.id];

              const hasResult = match.played;

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
                  pointsEarned = scoreMatchPrediction(match as any, pred as any, config);
                }
              }

              return (
                <Card
                  key={match.id}
                  className={`border-border bg-card ${resultKind === "exact" ? "border-primary/40" : ""}`}
                >
                  <CardContent className="p-3 sm:p-4 space-y-2">
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="text-[10px] sm:text-xs font-medium text-muted-foreground w-6 sm:w-8 text-center shrink-0">
                        #{match.match_number}
                      </div>
                      <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2 min-w-0">
                        <span className="truncate text-xs sm:text-sm font-medium text-foreground">
                          {teamA?.name ?? "TBD"}
                        </span>
                        <TeamFlag code={teamA?.code} name={teamA?.name} size={20} />
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <span className="h-8 w-10 sm:h-10 sm:w-14 flex items-center justify-center text-sm sm:text-lg font-bold text-foreground bg-muted rounded-md">
                          {pred?.predicted_score_a ?? "-"}
                        </span>
                        <span className="text-muted-foreground font-bold text-xs sm:text-base">:</span>
                        <span className="h-8 w-10 sm:h-10 sm:w-14 flex items-center justify-center text-sm sm:text-lg font-bold text-foreground bg-muted rounded-md">
                          {pred?.predicted_score_b ?? "-"}
                        </span>
                      </div>
                      <div className="flex flex-1 items-center gap-1.5 sm:gap-2 min-w-0">
                        <TeamFlag code={teamB?.code} name={teamB?.name} size={20} />
                        <span className="truncate text-xs sm:text-sm font-medium text-foreground">
                          {teamB?.name ?? "TBD"}
                        </span>
                      </div>
                    </div>
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
            })}
        </TabsContent>
      ))}
      </Tabs>

      {bonusPred && (
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
      )}
    </div>
  );
}
