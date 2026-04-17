import { Lock } from "lucide-react";
import {
  formatMaltaDate,
  formatMaltaTime,
  type LocalPrediction,
  type Match,
  type Team,
} from "@/lib/tournament-utils";
import { TeamFlag } from "./TeamFlag";
import { ScoreStepper } from "./ScoreStepper";

interface Props {
  match: Match;
  teamA: Team | null;
  teamB: Team | null;
  prediction: LocalPrediction | undefined;
  locked: boolean;
  onChange: (field: "score_a" | "score_b" | "winner_id", value: any) => void;
}

export function MatchScoreRow({ match, teamA, teamB, prediction, locked, onChange }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-3">
      <div className="flex w-20 shrink-0 flex-col text-[10px] leading-tight text-muted-foreground">
        <span className="font-semibold text-foreground">{formatMaltaDate(match.match_date)}</span>
        <span>{formatMaltaTime(match.match_date)} MLT</span>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
        <span className="truncate text-sm font-medium text-foreground">
          {teamA?.name ?? "TBD"}
        </span>
        <TeamFlag code={teamA?.code} name={teamA?.name} size={28} />
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <ScoreStepper
          value={prediction?.score_a ?? null}
          onChange={(v) => onChange("score_a", v)}
          disabled={locked}
        />
        <span className="text-muted-foreground font-bold">:</span>
        <ScoreStepper
          value={prediction?.score_b ?? null}
          onChange={(v) => onChange("score_b", v)}
          disabled={locked}
        />
      </div>

      <div className="flex flex-1 items-center gap-2 min-w-0">
        <TeamFlag code={teamB?.code} name={teamB?.name} size={28} />
        <span className="truncate text-sm font-medium text-foreground">
          {teamB?.name ?? "TBD"}
        </span>
      </div>

      {locked && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
    </div>
  );
}
