import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, ArrowUp, ArrowDown, Scale, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { MatchScoreRow } from "./MatchScoreRow";
import { TeamFlag } from "./TeamFlag";
import {
  computeGroupStandingsWithTies,
  isGroupComplete,
  type GroupTiebreakerPick,
  type LocalPrediction,
  type Match,
  type Prediction,
  type Team,
} from "@/lib/tournament-utils";
import { cn } from "@/lib/utils";
import type { MatchSaveStatus } from "./PredictionsTab";

interface Props {
  teams: Team[];
  matches: Match[];
  predictions: Record<string, Prediction>;
  localPredictions: Record<string, LocalPrediction>;
  isLocked: boolean;
  onChange: (matchId: string, field: "score_a" | "score_b" | "winner_id", value: any) => void;
  saveStatus?: Record<string, MatchSaveStatus>;
  onLuckyPick?: (matchId: string, teamAId: string, teamBId: string) => void;
  groupTiebreakers?: GroupTiebreakerPick[];
  onResolveGroupTie?: (pick: GroupTiebreakerPick) => void;
}

export function GroupStageView({
  teams,
  matches,
  predictions,
  localPredictions,
  isLocked,
  onChange,
  saveStatus,
  onLuckyPick,
  groupTiebreakers,
  onResolveGroupTie,
}: Props) {
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
  const groupNames = [...new Set(teams.map((t) => t.group_name))].sort();
  const allPicks = groupTiebreakers ?? [];
  const [openTieGroup, setOpenTieGroup] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groupNames.map((g) => {
        const groupTeams = teams.filter((t) => t.group_name === g);
        const groupMatches = matches.filter(
          (m) => m.round === "group" && m.team_a_id && groupTeams.some((t) => t.id === m.team_a_id),
        );
        const { standings, unresolvedTies } = computeGroupStandingsWithTies(
          groupTeams,
          groupMatches,
          localPredictions,
          allPicks,
        );
        // Re-run WITHOUT user picks to discover all tied sets that exist after
        // pts→GD→GF→H2H. Any tie not in `unresolvedTies` (with picks applied)
        // but present here is one the user resolved manually.
        const { unresolvedTies: rawTies } = computeGroupStandingsWithTies(
          groupTeams,
          groupMatches,
          localPredictions,
          [],
        );
        const unresolvedKeys = new Set(unresolvedTies.map((t) => t.tieKey));
        const resolvedTies = rawTies.filter((t) => !unresolvedKeys.has(t.tieKey));
        const complete = isGroupComplete(groupMatches, localPredictions);
        const winnerId = complete ? standings[0]?.team.id : null;
        const runnerUpId = complete ? standings[1]?.team.id : null;

        return (
          <Card key={g} className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-primary">
                    Group {g}
                  </span>
                </span>
                {complete && (
                  <Badge variant="outline" className="border-gold/40 text-gold">
                    <Trophy className="mr-1 h-3 w-3" /> Complete
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Unresolved tie — prominent CTA to open the picker modal */}
              {complete && unresolvedTies.length > 0 && !isLocked && onResolveGroupTie && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenTieGroup(g)}
                  className="w-full justify-start border-gold/60 bg-gold/10 text-gold hover:bg-gold/20 hover:text-gold"
                >
                  <Scale className="mr-2 h-4 w-4" />
                  <span className="truncate text-left">
                    Resolve tie — pick order for{" "}
                    {unresolvedTies
                      .flatMap((t) => t.teamIds.map((id) => teamMap[id]?.name).filter(Boolean))
                      .join(", ")}
                  </span>
                </Button>
              )}

              {/* Manually resolved — show note + Change action */}
              {complete && resolvedTies.length > 0 && (
                <div className="rounded-md border border-border bg-muted/30 p-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      {resolvedTies.map((tie) => (
                        <div key={tie.tieKey} className="text-muted-foreground">
                          {tie.teamIds.map((id) => teamMap[id]?.name ?? "?").join(" & ")} were
                          tied — order set manually.
                        </div>
                      ))}
                      {!isLocked && onResolveGroupTie && (
                        <button
                          type="button"
                          onClick={() => setOpenTieGroup(g)}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          Change
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal picker */}
              {onResolveGroupTie && (
                <GroupTieDialog
                  open={openTieGroup === g}
                  onOpenChange={(o) => setOpenTieGroup(o ? g : null)}
                  groupName={g}
                  ties={[...unresolvedTies, ...resolvedTies]}
                  standings={standings.map((s) => s.team.id)}
                  teamMap={teamMap}
                  currentPicks={allPicks}
                  onSave={(picks) => {
                    for (const p of picks) onResolveGroupTie(p);
                    setOpenTieGroup(null);
                  }}
                />
              )}

              {/* Standings table */}
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">#</th>
                      <th className="px-2 py-1.5 text-left font-medium">Team</th>
                      <th className="px-1 py-1.5 text-center font-medium">P</th>
                      <th className="px-1 py-1.5 text-center font-medium">W</th>
                      <th className="px-1 py-1.5 text-center font-medium">D</th>
                      <th className="px-1 py-1.5 text-center font-medium">L</th>
                      <th className="px-1 py-1.5 text-center font-medium">GD</th>
                      <th className="px-2 py-1.5 text-center font-bold">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => {
                      const isWinner = s.team.id === winnerId;
                      const isRunnerUp = s.team.id === runnerUpId;
                      return (
                        <tr
                          key={s.team.id}
                          className={cn(
                            "border-t border-border",
                            isWinner && "bg-gold/15 font-semibold text-gold",
                            isRunnerUp && "bg-primary/10 text-primary",
                          )}
                        >
                          <td className="px-2 py-1.5">
                            {isWinner ? (
                              <Trophy className="h-3 w-3" />
                            ) : isRunnerUp ? (
                              <Medal className="h-3 w-3" />
                            ) : (
                              i + 1
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="inline-flex items-center gap-1.5">
                              <TeamFlag code={s.team.code} name={s.team.name} size={18} />
                              {s.team.name}
                            </span>
                          </td>
                          <td className="px-1 py-1.5 text-center">{s.played}</td>
                          <td className="px-1 py-1.5 text-center">{s.wins}</td>
                          <td className="px-1 py-1.5 text-center">{s.draws}</td>
                          <td className="px-1 py-1.5 text-center">{s.losses}</td>
                          <td className="px-1 py-1.5 text-center">
                            {s.gd > 0 ? "+" : ""}
                            {s.gd}
                          </td>
                          <td className="px-2 py-1.5 text-center font-bold">{s.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Matches */}
              <div className="space-y-2">
                {groupMatches.map((m) => {
                  const existing = predictions[m.id];
                  const locked = isLocked || existing?.locked;
                  return (
                    <MatchScoreRow
                      key={m.id}
                      match={m}
                      teamA={m.team_a_id ? teamMap[m.team_a_id] : null}
                      teamB={m.team_b_id ? teamMap[m.team_b_id] : null}
                      prediction={localPredictions[m.id]}
                      locked={!!locked}
                      onChange={(field, value) => onChange(m.id, field, value)}
                      saveStatus={saveStatus?.[m.id]}
                      onLuckyPick={
                        onLuckyPick && m.team_a_id && m.team_b_id
                          ? () => onLuckyPick(m.id, m.team_a_id!, m.team_b_id!)
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
