import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Lock, Clock, Save, Loader2 } from "lucide-react";
import { GroupStageView } from "./GroupStageView";
import { KnockoutBracketView } from "./KnockoutBracketView";
import { BonusPicksTab } from "./BonusPicksTab";
import type {
  LocalPrediction,
  Match,
  Prediction,
  Team,
} from "@/lib/tournament-utils";
import { formatMaltaDate, formatMaltaTime } from "@/lib/tournament-utils";

interface PredictionsTabProps {
  userId: string;
  deadline: string | null;
}

export function PredictionsTab({ userId, deadline }: PredictionsTabProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [localPredictions, setLocalPredictions] = useState<Record<string, LocalPrediction>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    const [teamsRes, matchesRes, predictionsRes] = await Promise.all([
      supabase.from("teams").select("*").order("group_name").order("name"),
      supabase.from("matches").select("*").order("match_number"),
      supabase.from("predictions").select("*").eq("user_id", userId),
    ]);

    setTeams(teamsRes.data ?? []);
    setMatches(matchesRes.data ?? []);

    const predMap: Record<string, Prediction> = {};
    const localMap: Record<string, LocalPrediction> = {};
    for (const p of (predictionsRes.data ?? []) as any[]) {
      predMap[p.match_id] = p;
      localMap[p.match_id] = {
        winner_id: p.predicted_winner_id,
        score_a: p.predicted_score_a,
        score_b: p.predicted_score_b,
        team_through: p.predicted_team_through ?? null,
      };
    }
    setPredictions(predMap);
    setLocalPredictions(localMap);
    setLoading(false);
  }

  const isLocked = deadline ? new Date() > new Date(deadline) : false;

  // All group-stage matches must have both predicted scores filled in
  // before the user can edit the knockout bracket.
  const groupMatches = matches.filter((m) => m.round === "group");
  const groupComplete =
    groupMatches.length > 0 &&
    groupMatches.every((m) => {
      const p = localPredictions[m.id];
      return p && p.score_a != null && p.score_b != null;
    });
  const groupRemaining = groupMatches.filter((m) => {
    const p = localPredictions[m.id];
    return !p || p.score_a == null || p.score_b == null;
  }).length;
  const knockoutLocked = isLocked || !groupComplete;

  function setLocalPrediction(matchId: string, field: string, value: any) {
    setLocalPredictions((prev) => ({
      ...prev,
      [matchId]: {
        winner_id: prev[matchId]?.winner_id ?? null,
        score_a: prev[matchId]?.score_a ?? null,
        score_b: prev[matchId]?.score_b ?? null,
        team_through: prev[matchId]?.team_through ?? null,
        [field]: value,
      },
    }));
  }

  async function savePredictions() {
    setSaving(true);
    for (const [matchId, pred] of Object.entries(localPredictions)) {
      const existing = predictions[matchId];
      if (existing?.locked) continue;
      if (pred.score_a == null && pred.score_b == null && !pred.winner_id) continue;

      // Auto-derive winner from scores for knockouts
      const match = matches.find((m) => m.id === matchId);
      let winner_id = pred.winner_id;
      if (
        match &&
        match.round !== "group" &&
        pred.score_a != null &&
        pred.score_b != null &&
        pred.score_a !== pred.score_b
      ) {
        winner_id = pred.score_a > pred.score_b ? match.team_a_id : match.team_b_id;
      }

      const data: any = {
        user_id: userId,
        match_id: matchId,
        predicted_winner_id: winner_id,
        predicted_score_a: pred.score_a,
        predicted_score_b: pred.score_b,
        predicted_team_through: pred.team_through ?? null,
      };

      if (existing) {
        await supabase.from("predictions").update(data).eq("id", existing.id);
      } else {
        await supabase.from("predictions").insert(data);
      }
    }
    await loadData();
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="py-20 text-center">
        <Trophy className="mx-auto h-16 w-16 text-muted-foreground/30" />
        <h3 className="mt-4 text-xl font-semibold text-foreground">No Matches Yet</h3>
        <p className="mt-2 text-muted-foreground">
          The admin hasn't set up the tournament matches yet. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Deadline banner */}
      {deadline && (
        <div
          className={`flex items-center justify-between rounded-lg border p-4 ${isLocked ? "border-destructive/30 bg-destructive/5" : "border-gold/30 bg-gold/5"}`}
        >
          <div className="flex items-center gap-2">
            {isLocked ? (
              <Lock className="h-4 w-4 text-destructive" />
            ) : (
              <Clock className="h-4 w-4 text-gold" />
            )}
            <span className="text-sm font-medium text-foreground">
              {isLocked
                ? "Predictions are locked"
                : `Deadline: ${formatMaltaDate(deadline)} · ${formatMaltaTime(deadline)} Malta time`}
            </span>
          </div>
          {!isLocked && (
            <Button onClick={savePredictions} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Predictions
            </Button>
          )}
        </div>
      )}

      {!deadline && (
        <div className="flex justify-end">
          <Button onClick={savePredictions} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Predictions
          </Button>
        </div>
      )}

      <Tabs defaultValue="groups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="groups">Group Stage</TabsTrigger>
          <TabsTrigger value="knockout">Knockout Bracket</TabsTrigger>
          <TabsTrigger value="bonus">Player Awards</TabsTrigger>
        </TabsList>

        <TabsContent value="groups">
          <GroupStageView
            teams={teams}
            matches={matches}
            predictions={predictions}
            localPredictions={localPredictions}
            isLocked={isLocked}
            onChange={setLocalPrediction}
          />
        </TabsContent>

        <TabsContent value="knockout">
          {!groupComplete && !isLocked && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 p-4">
              <Lock className="h-4 w-4 text-gold" />
              <span className="text-sm font-medium text-foreground">
                Knockout bracket is locked. Predict all group-stage matches to
                unlock ({groupRemaining} match{groupRemaining === 1 ? "" : "es"} remaining).
              </span>
            </div>
          )}
          <KnockoutBracketView
            teams={teams}
            matches={matches}
            predictions={predictions}
            localPredictions={localPredictions}
            isLocked={knockoutLocked}
            onChange={setLocalPrediction}
          />
        </TabsContent>

        <TabsContent value="bonus">
          <BonusPicksTab userId={userId} isLocked={isLocked} />
        </TabsContent>
      </Tabs>

      {!isLocked && (
        <div className="flex justify-end pt-2">
          <Button onClick={savePredictions} disabled={saving} size="lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Predictions
          </Button>
        </div>
      )}
    </div>
  );
}
