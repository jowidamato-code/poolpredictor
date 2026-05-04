import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, RotateCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Team {
  id: string;
  name: string;
  code: string;
  group_name: string;
}

interface MatchRow {
  id: string;
  round: string;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  played: boolean;
}

interface GroupOverride {
  group_name: string;
  winner_team_id: string | null;
  runner_up_team_id: string | null;
}

function deriveTop2(teams: Team[], matches: MatchRow[]): { winner: string | null; runnerUp: string | null } {
  const stats: Record<string, { pts: number; gd: number; gf: number }> = {};
  for (const t of teams) stats[t.id] = { pts: 0, gd: 0, gf: 0 };
  let anyPlayed = false;
  for (const m of matches) {
    if (!m.played || m.score_a == null || m.score_b == null) continue;
    if (!m.team_a_id || !m.team_b_id) continue;
    if (!stats[m.team_a_id] || !stats[m.team_b_id]) continue;
    anyPlayed = true;
    stats[m.team_a_id].gf += m.score_a;
    stats[m.team_a_id].gd += m.score_a - m.score_b;
    stats[m.team_b_id].gf += m.score_b;
    stats[m.team_b_id].gd += m.score_b - m.score_a;
    if (m.score_a > m.score_b) stats[m.team_a_id].pts += 3;
    else if (m.score_b > m.score_a) stats[m.team_b_id].pts += 3;
    else {
      stats[m.team_a_id].pts++;
      stats[m.team_b_id].pts++;
    }
  }
  if (!anyPlayed) return { winner: null, runnerUp: null };
  const sorted = teams.slice().sort((x, y) => {
    const sx = stats[x.id], sy = stats[y.id];
    return sy.pts - sx.pts || sy.gd - sx.gd || sy.gf - sx.gf;
  });
  return { winner: sorted[0]?.id ?? null, runnerUp: sorted[1]?.id ?? null };
}

export function GroupResultsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, GroupOverride>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [teamsRes, matchesRes, grRes] = await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase.from("matches").select("*").eq("round", "group"),
      (supabase as any).from("group_results").select("*"),
    ]);
    setTeams((teamsRes.data ?? []) as Team[]);
    setMatches((matchesRes.data ?? []) as MatchRow[]);
    const map: Record<string, GroupOverride> = {};
    for (const gr of (grRes.data ?? []) as any[]) {
      map[gr.group_name] = {
        group_name: gr.group_name,
        winner_team_id: gr.winner_team_id,
        runner_up_team_id: gr.runner_up_team_id,
      };
    }
    setOverrides(map);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const groupNames = Array.from(new Set(teams.map((t) => t.group_name))).sort();

  async function save(groupName: string, winner: string | null, runnerUp: string | null) {
    setSaving(groupName);
    const existing = overrides[groupName];
    const payload = {
      group_name: groupName,
      winner_team_id: winner,
      runner_up_team_id: runnerUp,
    };
    const { error } = await (supabase as any)
      .from("group_results")
      .upsert(payload, { onConflict: "group_name" });
    if (error) {
      alert("Failed to save: " + error.message);
    } else {
      setOverrides((prev) => ({ ...prev, [groupName]: { ...payload } }));
    }
    setSaving(null);
    void existing;
  }

  async function resetGroup(groupName: string) {
    setSaving(groupName);
    const { error } = await (supabase as any)
      .from("group_results")
      .delete()
      .eq("group_name", groupName);
    if (error) {
      alert("Failed to reset: " + error.message);
    } else {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[groupName];
        return next;
      });
    }
    setSaving(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Group Stage — Final Standings</CardTitle>
          <CardDescription>
            Auto-filled from match results (points → GD → goals scored). Override the
            winner / runner-up for any group where the tiebreaker requires fair-play
            points. Only affects group winner / runner-up scoring and downstream
            progression — match-result points are not affected.
          </CardDescription>
        </CardHeader>
      </Card>

      {groupNames.map((g) => {
        const groupTeams = teams.filter((t) => t.group_name === g);
        const groupMatches = matches.filter(
          (m) => m.team_a_id && groupTeams.some((t) => t.id === m.team_a_id),
        );
        const derived = deriveTop2(groupTeams, groupMatches);
        const ov = overrides[g];
        const winner = ov?.winner_team_id ?? derived.winner;
        const runnerUp = ov?.runner_up_team_id ?? derived.runnerUp;
        const isOverridden = !!ov;

        return (
          <Card key={g}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">Group {g}</p>
                {isOverridden && (
                  <Badge className="bg-gold/20 text-gold hover:bg-gold/20 text-[10px]">
                    Admin override
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Winner</label>
                  <Select
                    value={winner ?? ""}
                    onValueChange={(v) => save(g, v, runnerUp)}
                    disabled={saving === g}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupTeams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Runner-up</label>
                  <Select
                    value={runnerUp ?? ""}
                    onValueChange={(v) => save(g, winner, v)}
                    disabled={saving === g}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupTeams
                        .filter((t) => t.id !== winner)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                {saving === g && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {isOverridden ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetGroup(g)}
                    disabled={saving === g}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset to auto
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Auto-derived from results
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}