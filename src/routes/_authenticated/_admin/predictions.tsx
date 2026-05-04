import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Search, ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/predictions")({
  component: AdminPredictions,
});

interface Profile {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
}
interface Team { id: string; name: string; code: string; group_name: string }
interface Match {
  id: string;
  match_number: number;
  round: string;
  team_a_id: string | null;
  team_b_id: string | null;
  match_date: string | null;
}
interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  predicted_score_a: number | null;
  predicted_score_b: number | null;
  predicted_winner_id: string | null;
  predicted_team_through: string | null;
  updated_at: string;
  created_at: string;
}
interface BonusPrediction {
  user_id: string;
  top_scorer: string | null;
  golden_ball: string | null;
  young_player: string | null;
  most_assists: string | null;
  submitted_at: string | null;
  updated_at: string;
}

function csvEscape(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminPredictions() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [bonusPreds, setBonusPreds] = useState<BonusPrediction[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { fetchAllRows } = await import("@/lib/fetch-all");
      const [p, t, m, pr, bp] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("teams").select("*"),
        supabase.from("matches").select("*").order("match_number"),
        fetchAllRows<any>("predictions"),
        fetchAllRows<any>("bonus_predictions"),
      ]);
      setProfiles(p.data ?? []);
      setTeams(t.data ?? []);
      setMatches(m.data ?? []);
      setPredictions(pr as any);
      setBonusPreds(bp as any);
      setLoading(false);
    })();
  }, []);

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams],
  );
  const matchMap = useMemo(
    () => Object.fromEntries(matches.map((m) => [m.id, m])),
    [matches],
  );
  const predsByUser = useMemo(() => {
    const out: Record<string, Prediction[]> = {};
    for (const p of predictions) {
      (out[p.user_id] ??= []).push(p);
    }
    return out;
  }, [predictions]);
  const bonusByUser = useMemo(
    () => Object.fromEntries(bonusPreds.map((b) => [b.user_id, b])),
    [bonusPreds],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      [p.username, p.first_name, p.last_name]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(q)),
    );
  }, [profiles, search]);

  function teamLabel(id: string | null | undefined) {
    if (!id) return "";
    const t = teamMap[id];
    return t ? t.name : "";
  }

  function matchLabel(m: Match) {
    return `#${m.match_number} ${m.round} — ${teamLabel(m.team_a_id) || "TBD"} vs ${teamLabel(m.team_b_id) || "TBD"}`;
  }

  function exportUserCSV(profile: Profile) {
    const rows: string[][] = [
      ["Type", "Reference", "Question", "Answer", "Submission time"],
    ];
    const userPreds = predsByUser[profile.user_id] ?? [];
    const sorted = [...userPreds].sort((a, b) => {
      const ma = matchMap[a.match_id];
      const mb = matchMap[b.match_id];
      return (ma?.match_number ?? 0) - (mb?.match_number ?? 0);
    });
    for (const p of sorted) {
      const m = matchMap[p.match_id];
      if (!m) continue;
      const ref = `Match #${m.match_number} (${m.round})`;
      const fixture = `${teamLabel(m.team_a_id) || "TBD"} vs ${teamLabel(m.team_b_id) || "TBD"}`;
      rows.push([
        "Match",
        ref,
        `Predicted score: ${fixture}`,
        `${p.predicted_score_a ?? ""} - ${p.predicted_score_b ?? ""}`,
        p.updated_at,
      ]);
      if (p.predicted_team_through) {
        rows.push([
          "Match",
          ref,
          `Team to advance (${fixture})`,
          teamLabel(p.predicted_team_through),
          p.updated_at,
        ]);
      }
    }
    const b = bonusByUser[profile.user_id];
    if (b) {
      const ts = b.submitted_at ?? b.updated_at;
      rows.push(["Award", "Player Awards", "Top Scorer (Golden Boot)", b.top_scorer ?? "", ts]);
      rows.push(["Award", "Player Awards", "Best Player (Golden Ball)", b.golden_ball ?? "", ts]);
      rows.push(["Award", "Player Awards", "Best Young Player", b.young_player ?? "", ts]);
      rows.push(["Award", "Player Awards", "Most Assists", b.most_assists ?? "", ts]);
    }
    const safeName = `${profile.username}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadCSV(`predictions_${safeName}.csv`, rows);
  }

  function exportAllCSV() {
    const rows: string[][] = [
      [
        "Username",
        "First name",
        "Last name",
        "Type",
        "Reference",
        "Question",
        "Answer",
        "Submission time",
      ],
    ];
    for (const profile of profiles) {
      const userPreds = predsByUser[profile.user_id] ?? [];
      const sorted = [...userPreds].sort((a, b) => {
        const ma = matchMap[a.match_id];
        const mb = matchMap[b.match_id];
        return (ma?.match_number ?? 0) - (mb?.match_number ?? 0);
      });
      for (const p of sorted) {
        const m = matchMap[p.match_id];
        if (!m) continue;
        const ref = `Match #${m.match_number} (${m.round})`;
        const fixture = `${teamLabel(m.team_a_id) || "TBD"} vs ${teamLabel(m.team_b_id) || "TBD"}`;
        rows.push([
          profile.username,
          profile.first_name,
          profile.last_name,
          "Match",
          ref,
          `Predicted score: ${fixture}`,
          `${p.predicted_score_a ?? ""} - ${p.predicted_score_b ?? ""}`,
          p.updated_at,
        ]);
        if (p.predicted_team_through) {
          rows.push([
            profile.username,
            profile.first_name,
            profile.last_name,
            "Match",
            ref,
            `Team to advance (${fixture})`,
            teamLabel(p.predicted_team_through),
            p.updated_at,
          ]);
        }
      }
      const b = bonusByUser[profile.user_id];
      if (b) {
        const ts = b.submitted_at ?? b.updated_at;
        const base = [profile.username, profile.first_name, profile.last_name];
        rows.push([...base, "Award", "Player Awards", "Top Scorer (Golden Boot)", b.top_scorer ?? "", ts]);
        rows.push([...base, "Award", "Player Awards", "Best Player (Golden Ball)", b.golden_ball ?? "", ts]);
        rows.push([...base, "Award", "Player Awards", "Best Young Player", b.young_player ?? "", ts]);
        rows.push([...base, "Award", "Player Awards", "Most Assists", b.most_assists ?? "", ts]);
      }
    }
    downloadCSV(`all_predictions_${new Date().toISOString().slice(0, 10)}.csv`, rows);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">User Predictions</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            View every user's submissions and export them as CSV.
          </p>
        </div>
        <Button onClick={exportAllCSV} className="w-full sm:w-auto">
          <Download className="h-4 w-4 mr-1" /> Download all (CSV)
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((profile) => {
          const userPreds = predsByUser[profile.user_id] ?? [];
          const bonus = bonusByUser[profile.user_id];
          const isOpen = expanded === profile.user_id;
          const lastUpdate = [
            ...userPreds.map((p) => p.updated_at),
            bonus?.submitted_at ?? bonus?.updated_at,
          ].filter(Boolean).sort().pop();
          const sorted = [...userPreds].sort((a, b) => {
            const ma = matchMap[a.match_id];
            const mb = matchMap[b.match_id];
            return (ma?.match_number ?? 0) - (mb?.match_number ?? 0);
          });

          return (
            <Card key={profile.user_id}>
              <CardHeader
                className="cursor-pointer gap-3 py-4"
                onClick={() => setExpanded(isOpen ? null : profile.user_id)}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <div className="min-w-0">
                      <CardTitle className="truncate text-sm sm:text-base">
                        {profile.first_name} {profile.last_name}
                      </CardTitle>
                      <CardDescription className="truncate text-xs">
                        @{profile.username} · {userPreds.length} picks
                        {bonus ? " · awards" : ""}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {lastUpdate && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs">
                        Last: {new Date(lastUpdate).toLocaleDateString()}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportUserCSV(profile);
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {isOpen && (
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Match predictions</h4>
                    {sorted.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No match predictions yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-xs uppercase text-muted-foreground">
                            <tr className="border-b border-border">
                              <th className="text-left py-2 pr-3">Match</th>
                              <th className="text-left py-2 pr-3">Score</th>
                              <th className="text-left py-2 pr-3">Advances</th>
                              <th className="text-left py-2">Submitted</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map((p) => {
                              const m = matchMap[p.match_id];
                              if (!m) return null;
                              return (
                                <tr key={p.id} className="border-b border-border/50">
                                  <td className="py-2 pr-3">{matchLabel(m)}</td>
                                  <td className="py-2 pr-3 font-mono">
                                    {p.predicted_score_a ?? "-"} : {p.predicted_score_b ?? "-"}
                                  </td>
                                  <td className="py-2 pr-3">{teamLabel(p.predicted_team_through)}</td>
                                  <td className="py-2 text-xs text-muted-foreground">
                                    {new Date(p.updated_at).toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Player awards</h4>
                    {bonus ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div><span className="text-muted-foreground">Top Scorer:</span> {bonus.top_scorer || "—"}</div>
                        <div><span className="text-muted-foreground">Golden Ball:</span> {bonus.golden_ball || "—"}</div>
                        <div><span className="text-muted-foreground">Young Player:</span> {bonus.young_player || "—"}</div>
                        <div><span className="text-muted-foreground">Most Assists:</span> {bonus.most_assists || "—"}</div>
                        <div className="md:col-span-2 text-xs text-muted-foreground pt-1">
                          Submitted: {new Date(bonus.submitted_at ?? bonus.updated_at).toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No award picks yet.</p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No users match your search.</p>
        )}
      </div>
    </div>
  );
}
