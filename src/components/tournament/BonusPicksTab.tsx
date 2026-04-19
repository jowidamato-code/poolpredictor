import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Trophy, Star, Lock, Clock } from "lucide-react";
import { TeamFlag } from "./TeamFlag";
import { KNOCKOUT_ROUNDS, ROUND_LABELS, type Match, type Team } from "@/lib/tournament-utils";
import { deriveProgressionFromBracket } from "@/lib/scoring";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  isLocked: boolean;
}

interface BonusState {
  group_winners: Record<string, string>;
  group_runners_up: Record<string, string>;
  knockout_winners: Record<string, string>; // matchId -> teamId
  top_scorer: string;
  golden_ball: string;
  young_player: string;
  most_assists: string;
  submitted_at: string | null;
}

const EMPTY: BonusState = {
  group_winners: {},
  group_runners_up: {},
  knockout_winners: {},
  top_scorer: "",
  golden_ball: "",
  young_player: "",
  most_assists: "",
  submitted_at: null,
};

export function BonusPicksTab({ userId, isLocked }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [state, setState] = useState<BonusState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const [teamsRes, matchesRes, bonusRes] = await Promise.all([
      supabase.from("teams").select("*").order("group_name").order("name"),
      supabase.from("matches").select("*").order("match_number"),
      (supabase as any)
        .from("bonus_predictions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    setTeams((teamsRes.data ?? []) as Team[]);
    setMatches((matchesRes.data ?? []) as Match[]);

    const b = bonusRes.data;
    if (b) {
      setState({
        group_winners: b.group_winners ?? {},
        group_runners_up: b.group_runners_up ?? {},
        knockout_winners: b.team_progression?.knockout_winners ?? {},
        top_scorer: b.top_scorer ?? "",
        golden_ball: b.golden_ball ?? "",
        young_player: b.young_player ?? "",
        most_assists: b.most_assists ?? "",
        submitted_at: b.submitted_at,
      });
    }
    setLoading(false);
  }

  const teamMap = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const groups = useMemo(() => [...new Set(teams.map((t) => t.group_name))].sort(), [teams]);
  const knockoutMatches = useMemo(
    () => matches.filter((m) => m.round !== "group"),
    [matches],
  );

  async function save() {
    if (isLocked) return;
    setSaving(true);

    const progression = deriveProgressionFromBracket(knockoutMatches, state.knockout_winners);
    const team_progression = {
      ...progression,
      knockout_winners: state.knockout_winners,
    };

    const payload = {
      user_id: userId,
      group_winners: state.group_winners,
      group_runners_up: state.group_runners_up,
      team_progression,
      top_scorer: state.top_scorer || null,
      golden_ball: state.golden_ball || null,
      young_player: state.young_player || null,
      most_assists: state.most_assists || null,
      submitted_at: state.submitted_at ?? new Date().toISOString(),
    };

    await (supabase as any)
      .from("bonus_predictions")
      .upsert(payload, { onConflict: "user_id" });

    await load();
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {state.submitted_at && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Picks first submitted: {new Date(state.submitted_at).toLocaleString()} — used as tiebreaker.
        </div>
      )}

      {/* Group winners & runners-up */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-primary" /> Group Winners & Runners-up
          </CardTitle>
          <CardDescription>+8 pts per correct winner, +5 per correct runner-up</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {groups.map((g) => {
            const groupTeams = teams.filter((t) => t.group_name === g);
            return (
              <div key={g} className="rounded-md border border-border p-3 space-y-2">
                <div className="text-sm font-semibold text-foreground">Group {g}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Winner</Label>
                    <Select
                      disabled={isLocked}
                      value={state.group_winners[g] ?? ""}
                      onValueChange={(v) =>
                        setState((s) => ({
                          ...s,
                          group_winners: { ...s.group_winners, [g]: v },
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                      <SelectContent>
                        {groupTeams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Runner-up</Label>
                    <Select
                      disabled={isLocked}
                      value={state.group_runners_up[g] ?? ""}
                      onValueChange={(v) =>
                        setState((s) => ({
                          ...s,
                          group_runners_up: { ...s.group_runners_up, [g]: v },
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                      <SelectContent>
                        {groupTeams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Knockout bracket — pick winner of each tie */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Knockout Bracket — Pick Winners</CardTitle>
          <CardDescription>
            Click the team you think advances. Progression points awarded per round.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {KNOCKOUT_ROUNDS.map((round) => {
                const ms = knockoutMatches.filter((m) => m.round === round);
                if (ms.length === 0) return null;
                return (
                  <div key={round} className="flex flex-col gap-2 min-w-[220px]">
                    <div className="rounded bg-primary/15 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-primary">
                      {ROUND_LABELS[round]}
                    </div>
                    <div className="flex flex-1 flex-col justify-around gap-2">
                      {ms.map((m) => (
                        <div key={m.id} className="rounded border border-border bg-card p-2 space-y-1">
                          {[m.team_a_id, m.team_b_id].map((tid, i) => {
                            const team = tid ? teamMap[tid] : null;
                            const picked = state.knockout_winners[m.id] === tid;
                            return (
                              <button
                                key={i}
                                type="button"
                                disabled={isLocked || !team}
                                onClick={() =>
                                  setState((s) => ({
                                    ...s,
                                    knockout_winners: { ...s.knockout_winners, [m.id]: tid! },
                                  }))
                                }
                                className={cn(
                                  "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-xs text-left",
                                  picked
                                    ? "bg-primary/20 font-semibold text-primary"
                                    : "hover:bg-muted",
                                  !team && "italic text-muted-foreground",
                                )}
                              >
                                <TeamFlag code={team?.code} name={team?.name} size={16} />
                                <span className="truncate">{team?.name ?? "TBD"}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Player awards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-gold" /> Player Awards
          </CardTitle>
          <CardDescription>Type the player's name. Matched case-insensitively.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            { key: "top_scorer", label: "Top Goalscorer (20 pts)" },
            { key: "golden_ball", label: "Best Player / Golden Ball (15 pts)" },
            { key: "young_player", label: "Best Young Player (10 pts)" },
            { key: "most_assists", label: "Most Assists (10 pts)" },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                disabled={isLocked}
                value={(state as any)[key]}
                placeholder="Player name"
                onChange={(e) => setState((s) => ({ ...s, [key]: e.target.value }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {!isLocked ? (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} size="lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Bonus Picks
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <Lock className="h-4 w-4" /> Bonus picks are locked.
        </div>
      )}
    </div>
  );
}
