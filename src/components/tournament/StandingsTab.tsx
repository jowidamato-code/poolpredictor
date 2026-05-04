import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MyPredictionsTab } from "./MyPredictionsTab";
import {
  buildScoringConfig,
  scoreMatchPrediction,
  scoreBonusPrediction,
  scoreDerivedGroupStage,
  scoreDerivedProgression,
} from "@/lib/scoring";
import { fetchAdminUserIds } from "@/lib/participants";
import { fetchAllRows } from "@/lib/fetch-all";

interface Standing {
  user_id: string;
  first_name: string;
  last_name: string;
  points: number;
  submitted_at: string | null;
}

export function StandingsTab() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [selected, setSelected] = useState<Standing | null>(null);

  useEffect(() => {
    loadStandings();
  }, []);

  const deadlinePassed = deadline ? new Date() >= deadline : false;

  async function loadStandings() {
    const [profilesRes, predsAll, matchesRes, teamsRes, settingsRes, bonusPredsAll, bonusResultsRes, groupResultsRes, verdictsRes, adminIds] =
      await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name"),
        fetchAllRows<any>("predictions"),
        supabase.from("matches").select("*"),
        supabase.from("teams").select("*"),
        supabase.from("settings").select("*"),
        fetchAllRows<any>("bonus_predictions"),
        (supabase as any).from("bonus_results").select("*").maybeSingle(),
        (supabase as any).from("group_results").select("*"),
        (supabase as any).from("bonus_award_verdicts").select("*"),
        fetchAdminUserIds(),
      ]);

    const profiles = (profilesRes.data ?? []).filter(
      (p: any) => !adminIds.has(p.user_id),
    );
    const allPreds = predsAll;
    const allMatches = matchesRes.data ?? [];
    const allTeams = teamsRes.data ?? [];
    const settingsMap = Object.fromEntries(
      (settingsRes.data ?? []).map((s) => [s.key, s.value]),
    );
    const config = buildScoringConfig(settingsMap);
    const rawDeadline = settingsMap["prediction_deadline"];
    if (rawDeadline) {
      const str = typeof rawDeadline === "string" ? rawDeadline.replace(/^"|"$/g, "") : String(rawDeadline);
      const d = new Date(str);
      if (!isNaN(d.getTime())) setDeadline(d);
    }
    const bonusPreds = bonusPredsAll;
    const bonusResult = bonusResultsRes.data;
    const verdictMap: Record<string, Record<string, "won" | "lost">> = {};
    for (const v of (verdictsRes.data ?? []) as any[]) {
      (verdictMap[v.user_id] ??= {})[v.award] = v.verdict;
    }
    const groupOverrides: Record<string, { winner_team_id: string | null; runner_up_team_id: string | null }> = {};
    for (const gr of (groupResultsRes.data ?? []) as any[]) {
      groupOverrides[gr.group_name] = {
        winner_team_id: gr.winner_team_id,
        runner_up_team_id: gr.runner_up_team_id,
      };
    }

    const matchById = Object.fromEntries(allMatches.map((m: any) => [m.id, m]));

    const points: Record<string, number> = {};
    const submitted: Record<string, string | null> = {};
    const userPredsByUser: Record<string, any[]> = {};
    for (const p of profiles) {
      points[p.user_id] = 0;
      submitted[p.user_id] = null;
      userPredsByUser[p.user_id] = [];
    }

    // Match-level points + collect user preds
    for (const pred of allPreds) {
      if (points[pred.user_id] === undefined) continue;
      userPredsByUser[pred.user_id].push(pred);
      const match = matchById[pred.match_id];
      if (!match || !match.played) continue;
      points[pred.user_id] += scoreMatchPrediction(match, pred as any, config);
    }

    // Derived group winners/runners-up + knockout progression (from match predictions vs results)
    for (const userId of Object.keys(points)) {
      const preds = userPredsByUser[userId];
      points[userId] += scoreDerivedGroupStage(allTeams as any, allMatches as any, preds, config, groupOverrides);
      points[userId] += scoreDerivedProgression(allMatches as any, preds, config);
    }

    // Player-award bonus + tiebreaker submission timestamp
    for (const bp of bonusPreds) {
      if (points[bp.user_id] === undefined) continue;
      submitted[bp.user_id] = bp.submitted_at;
      const v = verdictMap[bp.user_id] ?? {};
      points[bp.user_id] += scoreBonusPrediction(
        bp as any,
        (bonusResult ?? {}) as any,
        config,
        v,
      );
    }

    const sorted: Standing[] = profiles
      .map((p) => ({
        user_id: p.user_id,
        first_name: p.first_name,
        last_name: p.last_name,
        points: points[p.user_id] ?? 0,
        submitted_at: submitted[p.user_id],
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        // Tiebreaker: earliest submitted_at wins (nulls last)
        if (a.submitted_at && b.submitted_at) {
          return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        }
        if (a.submitted_at) return -1;
        if (b.submitted_at) return 1;
        return 0;
      });

    setStandings(sorted);
    setLoading(false);
  }

  const positionIcons = [
    <Trophy key="1" className="h-5 w-5 text-gold" />,
    <Medal key="2" className="h-5 w-5 text-muted-foreground" />,
    <Award key="3" className="h-5 w-5 text-chart-4" />,
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="bg-primary/5 border-b border-border">
        <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="w-8 text-center">#</span>
            <span>Name</span>
          </div>
          <span>Points</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {standings.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No standings yet. Matches haven't been played.
          </div>
        ) : (
          standings.map((player, index) => (
            <div
              key={player.user_id}
              role={deadlinePassed ? "button" : undefined}
              tabIndex={deadlinePassed ? 0 : undefined}
              onClick={() => deadlinePassed && setSelected(player)}
              onKeyDown={(e) => {
                if (deadlinePassed && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setSelected(player);
                }
              }}
              className={`flex items-center justify-between border-b border-border px-6 py-4 last:border-0 transition-colors ${
                index < 3 ? "bg-primary/5" : ""
              } ${deadlinePassed ? "cursor-pointer hover:bg-primary/10" : ""}`}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 items-center justify-center">
                  {index < 3 ? (
                    positionIcons[index]
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                  )}
                </div>
                <span className={`font-medium text-foreground ${deadlinePassed ? "underline-offset-4 hover:underline" : ""}`}>
                  {player.first_name} {player.last_name}
                </span>
              </div>
              <Badge
                variant={index === 0 ? "default" : "secondary"}
                className="min-w-[3rem] justify-center text-sm font-bold"
              >
                {player.points}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-x-hidden overflow-y-auto p-3 sm:p-6 gap-3 sm:gap-4 block">
          <DialogHeader className="mb-3">
            <DialogTitle className="text-base sm:text-lg pr-8">
              {selected ? `${selected.first_name} ${selected.last_name}'s Picks` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="min-w-0 w-full">
            {selected && <MyPredictionsTab userId={selected.user_id} />}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
