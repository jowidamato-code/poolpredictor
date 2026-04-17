import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import {
  KNOCKOUT_ROUNDS,
  ROUND_LABELS,
  formatMaltaDate,
  formatMaltaTime,
  type LocalPrediction,
  type Match,
  type Prediction,
  type Team,
} from "@/lib/tournament-utils";
import { cn } from "@/lib/utils";

interface Props {
  teams: Team[];
  matches: Match[];
  predictions: Record<string, Prediction>;
  localPredictions: Record<string, LocalPrediction>;
  isLocked: boolean;
  onChange: (matchId: string, field: "score_a" | "score_b" | "winner_id", value: any) => void;
}

export function KnockoutBracketView({
  teams,
  matches,
  predictions,
  localPredictions,
  isLocked,
  onChange,
}: Props) {
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {KNOCKOUT_ROUNDS.map((round) => {
          const roundMatches = matches.filter((m) => m.round === round);
          if (roundMatches.length === 0) return null;
          return (
            <div key={round} className="flex flex-col gap-3 min-w-[260px]">
              <div className="sticky top-0 rounded-md bg-primary/15 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-primary">
                {ROUND_LABELS[round]}
              </div>
              <div
                className={cn(
                  "flex flex-1 flex-col justify-around gap-3",
                  round === "final" && "justify-center",
                )}
              >
                {roundMatches.map((m) => {
                  const teamA = m.team_a_id ? teamMap[m.team_a_id] : null;
                  const teamB = m.team_b_id ? teamMap[m.team_b_id] : null;
                  const pred = localPredictions[m.id];
                  const existing = predictions[m.id];
                  const locked = isLocked || existing?.locked;

                  const scoreA = pred?.score_a;
                  const scoreB = pred?.score_b;
                  const hasScores = scoreA != null && scoreB != null;
                  const aWins = hasScores && scoreA! > scoreB!;
                  const bWins = hasScores && scoreB! > scoreA!;

                  return (
                    <Card
                      key={m.id}
                      className={cn(
                        "border-border bg-card p-2.5 space-y-1.5",
                        round === "final" && "border-gold/40 bg-gold/5",
                      )}
                    >
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          {formatMaltaDate(m.match_date)} · {formatMaltaTime(m.match_date)} MLT
                        </span>
                        {locked && <Lock className="h-3 w-3" />}
                      </div>

                      <TeamRow team={teamA} winning={aWins} />
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          className="h-8 flex-1 text-center text-sm font-bold"
                          placeholder="-"
                          value={scoreA ?? ""}
                          onChange={(e) =>
                            onChange(
                              m.id,
                              "score_a",
                              e.target.value ? parseInt(e.target.value) : null,
                            )
                          }
                          disabled={locked || !teamA}
                        />
                        <span className="text-xs font-bold text-muted-foreground">:</span>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          className="h-8 flex-1 text-center text-sm font-bold"
                          placeholder="-"
                          value={scoreB ?? ""}
                          onChange={(e) =>
                            onChange(
                              m.id,
                              "score_b",
                              e.target.value ? parseInt(e.target.value) : null,
                            )
                          }
                          disabled={locked || !teamB}
                        />
                      </div>
                      <TeamRow team={teamB} winning={bWins} />
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Knockout fixtures will populate as group winners and runners-up are confirmed. Enter scores
        to predict the winner of each tie.
      </p>
    </div>
  );
}

function TeamRow({ team, winning }: { team: Team | null; winning: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded px-2 py-1 text-sm",
        winning && "bg-primary/15 font-semibold text-primary",
        !team && "text-muted-foreground italic",
      )}
    >
      <span className="font-mono text-[10px] text-muted-foreground w-8">{team?.code ?? "—"}</span>
      <span className="truncate">{team?.name ?? "TBD"}</span>
    </div>
  );
}
