import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Lock, Clock, Loader2, CheckCircle2, Hourglass } from "lucide-react";
import { GroupStageView } from "./GroupStageView";
import { KnockoutBracketView } from "./KnockoutBracketView";
import { BonusPicksTab } from "./BonusPicksTab";
import { Fireworks } from "./Fireworks";
import type {
  LocalPrediction,
  Match,
  Prediction,
  Team,
} from "@/lib/tournament-utils";
import { formatMaltaDate, formatMaltaTime } from "@/lib/tournament-utils";
import { luckyPick } from "@/lib/lucky-pick";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PredictionsTabProps {
  userId: string;
  deadline: string | null;
}

export type MatchSaveStatus = "saving" | "saved" | "error";

export function PredictionsTab({ userId, deadline }: PredictionsTabProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [localPredictions, setLocalPredictions] = useState<Record<string, LocalPrediction>>({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<Record<string, MatchSaveStatus>>({});
  const [pendingLucky, setPendingLucky] = useState<{
    matchId: string;
    teamAId: string;
    teamBId: string;
  } | null>(null);
  const [showFireworks, setShowFireworks] = useState(false);
  const [innerTab, setInnerTab] = useState<string>("groups");
  const [bonusComplete, setBonusComplete] = useState(false);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedFlashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inFlight = useRef<Record<string, boolean>>({});
  const pendingResave = useRef<Record<string, boolean>>({});
  const localPredictionsRef = useRef<Record<string, LocalPrediction>>({});
  const matchesRef = useRef<Match[]>([]);
  const predictionsRef = useRef<Record<string, Prediction>>({});

  localPredictionsRef.current = localPredictions;
  matchesRef.current = matches;
  predictionsRef.current = predictions;

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

  const koMatches = matches.filter((m) => m.round !== "group");
  const knockoutComplete =
    koMatches.length > 0 &&
    koMatches.every((m) => {
      const p = localPredictions[m.id];
      if (!p || p.score_a == null || p.score_b == null) return false;
      if (p.score_a === p.score_b && !p.team_through) return false;
      return true;
    });

  function flashSaved(matchId: string) {
    setSaveStatus((s) => ({ ...s, [matchId]: "saved" }));
    if (savedFlashTimers.current[matchId]) clearTimeout(savedFlashTimers.current[matchId]);
    savedFlashTimers.current[matchId] = setTimeout(() => {
      setSaveStatus((s) => {
        if (s[matchId] !== "saved") return s;
        const next = { ...s };
        delete next[matchId];
        return next;
      });
    }, 1500);
  }

  function clearStatus(matchId: string) {
    setSaveStatus((s) => {
      if (!s[matchId]) return s;
      const next = { ...s };
      delete next[matchId];
      return next;
    });
  }

  async function saveMatch(matchId: string) {
    const match = matchesRef.current.find((m) => m.id === matchId);
    if (!match) return;
    const pred = localPredictionsRef.current[matchId];
    if (!pred) return;
    const existing = predictionsRef.current[matchId];
    if (existing?.locked) return;

    if (pred.score_a == null && pred.score_b == null && !pred.winner_id) return;

    // KO draw: don't persist until team_through is picked (if both teams known)
    if (
      match.round !== "group" &&
      pred.score_a != null &&
      pred.score_b != null &&
      pred.score_a === pred.score_b &&
      match.team_a_id &&
      match.team_b_id &&
      !pred.team_through
    ) {
      clearStatus(matchId);
      return;
    }

    if (inFlight.current[matchId]) {
      pendingResave.current[matchId] = true;
      return;
    }
    inFlight.current[matchId] = true;
    setSaveStatus((s) => ({ ...s, [matchId]: "saving" }));

    let winner_id = pred.winner_id;
    if (
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

    try {
      if (existing) {
        const { error } = await supabase
          .from("predictions")
          .update(data)
          .eq("id", existing.id);
        if (error) throw error;
        setPredictions((prev) => ({
          ...prev,
          [matchId]: { ...prev[matchId], ...data },
        }));
      } else {
        const { data: inserted, error } = await supabase
          .from("predictions")
          .insert(data)
          .select()
          .single();
        if (error) throw error;
        if (inserted) {
          setPredictions((prev) => ({ ...prev, [matchId]: inserted as any }));
        }
      }
      flashSaved(matchId);
    } catch (e) {
      console.error("Save failed", e);
      setSaveStatus((s) => ({ ...s, [matchId]: "error" }));
    } finally {
      inFlight.current[matchId] = false;
      if (pendingResave.current[matchId]) {
        pendingResave.current[matchId] = false;
        // re-run with latest values
        saveMatch(matchId);
      }
    }
  }

  function scheduleSave(matchId: string) {
    if (isLocked) return;
    if (saveTimers.current[matchId]) clearTimeout(saveTimers.current[matchId]);
    saveTimers.current[matchId] = setTimeout(() => {
      saveMatch(matchId);
    }, 400);
  }

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
    scheduleSave(matchId);
  }

  function applyLuckyPick(matchId: string, teamAId: string, teamBId: string) {
    const match = matchesRef.current.find((m) => m.id === matchId);
    if (!match) return;
    const teamA = teams.find((t) => t.id === teamAId);
    const teamB = teams.find((t) => t.id === teamBId);
    if (!teamA || !teamB) return;
    const isGroup = match.round === "group";
    const result = luckyPick({
      teamAId,
      teamBId,
      strengthA: teamA.strength,
      strengthB: teamB.strength,
      allowDraw: isGroup, // KO can technically allow draws too but we'd auto-pick advancer
    });
    setLocalPredictions((prev) => ({
      ...prev,
      [matchId]: {
        winner_id:
          !isGroup && result.score_a !== result.score_b
            ? result.score_a > result.score_b
              ? teamAId
              : teamBId
            : prev[matchId]?.winner_id ?? null,
        score_a: result.score_a,
        score_b: result.score_b,
        team_through:
          !isGroup && result.score_a === result.score_b
            ? result.team_through
            : prev[matchId]?.team_through ?? null,
      },
    }));
    scheduleSave(matchId);
  }

  function handleLuckyPick(matchId: string, teamAId: string, teamBId: string) {
    const existing = localPredictionsRef.current[matchId];
    const hasExisting = existing && (existing.score_a != null || existing.score_b != null);
    if (hasExisting) {
      setPendingLucky({ matchId, teamAId, teamBId });
      return;
    }
    applyLuckyPick(matchId, teamAId, teamBId);
  }

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach((t) => clearTimeout(t));
      Object.values(savedFlashTimers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

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
            <span className="text-xs text-muted-foreground">
              Each pick saves automatically
            </span>
          )}
        </div>
      )}

      <Tabs value={innerTab} onValueChange={setInnerTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="groups" className="gap-1.5">
            Group Stage
            {groupComplete ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Hourglass className="h-3.5 w-3.5 text-yellow-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="knockout" className="gap-1.5">
            Knockout Bracket
            {knockoutComplete ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Hourglass className="h-3.5 w-3.5 text-yellow-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="bonus" className="gap-1.5">
            Player Awards
            {bonusComplete ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Hourglass className="h-3.5 w-3.5 text-yellow-500" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groups">
          <GroupStageView
            teams={teams}
            matches={matches}
            predictions={predictions}
            localPredictions={localPredictions}
            isLocked={isLocked}
            onChange={setLocalPrediction}
            saveStatus={saveStatus}
            onLuckyPick={handleLuckyPick}
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
            saveStatus={saveStatus}
            onLuckyPick={handleLuckyPick}
            onFinalComplete={() => {
              setShowFireworks(true);
              setTimeout(() => {
                setShowFireworks(false);
                setInnerTab("bonus");
              }, 4000);
            }}
          />
        </TabsContent>

        <TabsContent value="bonus">
          <BonusPicksTab
            userId={userId}
            isLocked={isLocked}
            onCompletionChange={setBonusComplete}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!pendingLucky} onOpenChange={(o) => !o && setPendingLucky(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your prediction?</AlertDialogTitle>
            <AlertDialogDescription>
              You already entered a score for this match. Rolling the dice will
              overwrite it with an auto-generated plausible result.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my pick</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingLucky) {
                  applyLuckyPick(
                    pendingLucky.matchId,
                    pendingLucky.teamAId,
                    pendingLucky.teamBId,
                  );
                }
                setPendingLucky(null);
              }}
            >
              Roll the dice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showFireworks && <Fireworks />}
    </div>
  );
}
