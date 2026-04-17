import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import {
  formatMaltaDate,
  formatMaltaTime,
  type LocalPrediction,
  type Match,
  type Team,
} from "@/lib/tournament-utils";

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
        <span className="text-xs font-bold text-muted-foreground w-8 text-right">
          {teamA?.code ?? "?"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Input
          type="number"
          min={0}
          max={20}
          className="h-10 w-12 text-center text-base font-bold"
          placeholder="-"
          value={prediction?.score_a ?? ""}
          onChange={(e) => onChange("score_a", e.target.value ? parseInt(e.target.value) : null)}
          disabled={locked}
        />
        <span className="text-muted-foreground font-bold">:</span>
        <Input
          type="number"
          min={0}
          max={20}
          className="h-10 w-12 text-center text-base font-bold"
          placeholder="-"
          value={prediction?.score_b ?? ""}
          onChange={(e) => onChange("score_b", e.target.value ? parseInt(e.target.value) : null)}
          disabled={locked}
        />
      </div>

      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span className="text-xs font-bold text-muted-foreground w-8">{teamB?.code ?? "?"}</span>
        <span className="truncate text-sm font-medium text-foreground">
          {teamB?.name ?? "TBD"}
        </span>
      </div>

      {locked && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
    </div>
  );
}
