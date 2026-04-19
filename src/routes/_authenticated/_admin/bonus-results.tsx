import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { Loader2, Save, Trophy, Star } from "lucide-react";
import { TeamFlag } from "@/components/tournament/TeamFlag";
import {
  KNOCKOUT_ROUNDS,
  ROUND_LABELS,
  type Match,
  type Team,
} from "@/lib/tournament-utils";
import { deriveProgressionFromBracket } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_admin/bonus-results")({
  component: BonusResultsPage,
});

function BonusResultsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);
  const [groupWinners, setGroupWinners] = useState<Record<string, string>>({});
  const [groupRunnersUp, setGroupRunnersUp] = useState<Record<string, string>>({});
  const [knockoutWinners, setKnockoutWinners] = useState<Record<string, string>>({});
  const [topScorer, setTopScorer] = useState("");
  const [goldenBall, setGoldenBall] = useState("");
  const [youngPlayer, setYoungPlayer] = useState("");
  const [mostAssists, setMostAssists] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [teamsRes, matchesRes, resRes] = await Promise.all([
      supabase.from("teams").select("*").order("group_name").order("name"),
      supabase.from("matches").select("*").order("match_number"),
      (supabase as any).from("bonus_results").select("*").maybeSingle(),
    ]);
    setTeams((teamsRes.data ?? []) as Team[]);
    setMatches((matchesRes.data ?? []) as Match[]);

    const r = resRes.data;
    if (r) {
      setResultId(r.id);
      setGroupWinners(r.group_winners ?? {});
      setGroupRunnersUp(r.group_runners_up ?? {});
      setKnockoutWinners(r.team_progression?.knockout_winners ?? {});
      setTopScorer(r.top_scorer ?? "");
      setGoldenBall(r.golden_ball ?? "");
      setYoungPlayer(r.young_player ?? "");
      setMostAssists(r.most_assists ?? "");
    }
    setLoading(false);
  }

  const teamMap = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const groups = useMemo(() => [...new Set(teams.map((t) => t.group_name))].sort(), [teams]);
  const knockoutMatches = useMemo(() => matches.filter((m) => m.round !== "group"), [matches]);

  async function save() {
    setSaving(true);
    const progression = deriveProgressionFromBracket(knockoutMatches, knockoutWinners);
    const team_progression = { ...progression, knockout_winners: knockoutWinners };
    const payload = {
      group_winners: groupWinners,
      group_runners_up: groupRunnersUp,
      team_progression,
      top_scorer: topScorer || null,
      golden_ball: goldenBall || null,
      young_player: youngPlayer || null,
      most_assists: mostAssists || null,
    };
    if (resultId) {
      await (supabase as any).from("bonus_results").update(payload).eq("id", resultId);
    } else {
      const { data } = await (supabase as any).from("bonus_results").insert(payload).select().single();
      if (data) setResultId(data.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bonus Results</h2>
          <p className="text-sm text-muted-foreground">
            Enter actual outcomes to score everyone's bonus picks.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <span className="text-primary">✓ Saved</span>
          ) : (
            <><Save className="h-4 w-4" /> Save Results</>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-primary" /> Group Winners & Runners-up
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {groups.map((g) => {
            const groupTeams = teams.filter((t) => t.group_name === g);
            return (
              <div key={g} className="rounded-md border border-border p-3 space-y-2">
                <div className="text-sm font-semibold">Group {g}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Winner</Label>
                    <Select
                      value={groupWinners[g] ?? ""}
                      onValueChange={(v) =>
                        setGroupWinners((s) => ({ ...s, [g]: v }))
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
                    <Label className="text-xs">Runner-up</Label>
                    <Select
                      value={groupRunnersUp[g] ?? ""}
                      onValueChange={(v) =>
                        setGroupRunnersUp((s) => ({ ...s, [g]: v }))
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Knockout Bracket — Actual Winners</CardTitle>
          <CardDescription>Click the team that actually advanced.</CardDescription>
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
                    <div className="flex flex-col gap-2">
                      {ms.map((m) => (
                        <div key={m.id} className="rounded border border-border bg-card p-2 space-y-1">
                          {[m.team_a_id, m.team_b_id].map((tid, i) => {
                            const team = tid ? teamMap[tid] : null;
                            const picked = knockoutWinners[m.id] === tid;
                            return (
                              <button
                                key={i}
                                type="button"
                                disabled={!team}
                                onClick={() =>
                                  setKnockoutWinners((s) => ({ ...s, [m.id]: tid! }))
                                }
                                className={cn(
                                  "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-xs",
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-gold" /> Player Awards (actual winners)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Top Goalscorer</Label>
            <Input value={topScorer} onChange={(e) => setTopScorer(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Golden Ball</Label>
            <Input value={goldenBall} onChange={(e) => setGoldenBall(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Young Player</Label>
            <Input value={youngPlayer} onChange={(e) => setYoungPlayer(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Most Assists</Label>
            <Input value={mostAssists} onChange={(e) => setMostAssists(e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
