import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Lock, Clock, Save, Loader2 } from "lucide-react";
import type { AuthState } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/predictions")({
  component: PredictionsPage,
});

interface Team {
  id: string;
  name: string;
  code: string;
  group_name: string;
}

interface Match {
  id: string;
  round: string;
  match_number: number;
  team_a_id: string | null;
  team_b_id: string | null;
  match_date: string | null;
  played: boolean;
}

interface Prediction {
  id: string;
  match_id: string;
  predicted_winner_id: string | null;
  predicted_score_a: number | null;
  predicted_score_b: number | null;
  locked: boolean;
}

const ROUND_LABELS: Record<string, string> = {
  group: "Group Stage",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter_final: "Quarter Finals",
  semi_final: "Semi Finals",
  third_place: "Third Place",
  final: "Final",
};

function PredictionsPage() {
  const { auth } = Route.useRouteContext() as { auth: AuthState };
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [localPredictions, setLocalPredictions] = useState<
    Record<string, { winner_id: string | null; score_a: number | null; score_b: number | null }>
  >({});
  const [saving, setSaving] = useState(false);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [teamsRes, matchesRes, predictionsRes, settingsRes] = await Promise.all([
      supabase.from("teams").select("*").order("group_name").order("name"),
      supabase.from("matches").select("*").order("match_number"),
      supabase.from("predictions").select("*").eq("user_id", auth.user!.id),
      supabase.from("settings").select("*").eq("key", "prediction_deadline").single(),
    ]);

    setTeams(teamsRes.data ?? []);
    setMatches(matchesRes.data ?? []);

    const predMap: Record<string, Prediction> = {};
    const localMap: Record<string, any> = {};
    for (const p of predictionsRes.data ?? []) {
      predMap[p.match_id] = p;
      localMap[p.match_id] = {
        winner_id: p.predicted_winner_id,
        score_a: p.predicted_score_a,
        score_b: p.predicted_score_b,
      };
    }
    setPredictions(predMap);
    setLocalPredictions(localMap);

    if (settingsRes.data) {
      setDeadline(JSON.parse(JSON.stringify(settingsRes.data.value)));
    }
    setLoading(false);
  }

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
  const isLocked = deadline ? new Date() > new Date(deadline.replace(/"/g, "")) : false;

  const rounds = [...new Set(matches.map((m) => m.round))];

  function setLocalPrediction(matchId: string, field: string, value: any) {
    setLocalPredictions((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: value },
    }));
  }

  async function savePredictions() {
    if (!auth.user) return;
    setSaving(true);

    for (const [matchId, pred] of Object.entries(localPredictions)) {
      const existing = predictions[matchId];
      if (existing?.locked) continue;

      const data = {
        user_id: auth.user.id,
        match_id: matchId,
        predicted_winner_id: pred.winner_id,
        predicted_score_a: pred.score_a,
        predicted_score_b: pred.score_b,
      };

      if (existing) {
        await supabase.from("predictions").update(data).eq("id", existing.id);
      } else {
        await supabase.from("predictions").upsert(data);
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
        <h2 className="mt-4 text-xl font-semibold text-foreground">No Matches Yet</h2>
        <p className="mt-2 text-muted-foreground">
          The admin hasn't set up the tournament matches yet. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Predictions</h2>
          <p className="text-sm text-muted-foreground">
            Predict the winner and score for each match
          </p>
        </div>
        <div className="flex items-center gap-3">
          {deadline && (
            <Badge variant="outline" className="gap-1.5">
              <Clock className="h-3 w-3" />
              Deadline: {new Date(deadline.replace(/"/g, "")).toLocaleDateString()}
            </Badge>
          )}
          {isLocked ? (
            <Badge variant="destructive" className="gap-1.5">
              <Lock className="h-3 w-3" />
              Locked
            </Badge>
          ) : (
            <Button onClick={savePredictions} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Predictions
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue={rounds[0]} className="space-y-4">
        <TabsList className="flex-wrap">
          {rounds.map((round) => (
            <TabsTrigger key={round} value={round} className="text-xs">
              {ROUND_LABELS[round] ?? round}
            </TabsTrigger>
          ))}
        </TabsList>

        {rounds.map((round) => (
          <TabsContent key={round} value={round} className="space-y-3">
            {matches
              .filter((m) => m.round === round)
              .map((match) => {
                const teamA = match.team_a_id ? teamMap[match.team_a_id] : null;
                const teamB = match.team_b_id ? teamMap[match.team_b_id] : null;
                const pred = localPredictions[match.id];
                const existingPred = predictions[match.id];
                const matchLocked = isLocked || existingPred?.locked;

                return (
                  <Card key={match.id} className="border-border bg-card">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="text-xs font-medium text-muted-foreground w-8 text-center">
                        #{match.match_number}
                      </div>

                      {/* Team A */}
                      <div className="flex flex-1 items-center justify-end gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {teamA?.name ?? "TBD"}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground">
                          {teamA?.code ?? "?"}
                        </span>
                      </div>

                      {/* Score inputs */}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          className="h-10 w-14 text-center text-lg font-bold"
                          placeholder="-"
                          value={pred?.score_a ?? ""}
                          onChange={(e) =>
                            setLocalPrediction(
                              match.id,
                              "score_a",
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                          disabled={matchLocked}
                        />
                        <span className="text-muted-foreground font-bold">:</span>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          className="h-10 w-14 text-center text-lg font-bold"
                          placeholder="-"
                          value={pred?.score_b ?? ""}
                          onChange={(e) =>
                            setLocalPrediction(
                              match.id,
                              "score_b",
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                          disabled={matchLocked}
                        />
                      </div>

                      {/* Team B */}
                      <div className="flex flex-1 items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">
                          {teamB?.code ?? "?"}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {teamB?.name ?? "TBD"}
                        </span>
                      </div>

                      {/* Winner selection for knockout */}
                      {round !== "group" && teamA && teamB && (
                        <div className="flex gap-1">
                          {[teamA, teamB].map((team) => (
                            <Button
                              key={team.id}
                              size="sm"
                              variant={pred?.winner_id === team.id ? "default" : "outline"}
                              onClick={() => setLocalPrediction(match.id, "winner_id", team.id)}
                              disabled={matchLocked}
                              className="text-xs"
                            >
                              {team.code}
                            </Button>
                          ))}
                        </div>
                      )}

                      {matchLocked && (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
