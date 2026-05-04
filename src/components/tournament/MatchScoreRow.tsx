import { Lock, Dices } from "lucide-react";
import {
  formatMaltaDate,
  formatMaltaTime,
  type LocalPrediction,
  type Match,
  type Team,
} from "@/lib/tournament-utils";
import { TeamFlag } from "./TeamFlag";
import { ScoreStepper } from "./ScoreStepper";
import { SaveStatusBadge } from "./SaveStatusBadge";
import type { MatchSaveStatus } from "./PredictionsTab";

interface Props {
  match: Match;
  teamA: Team | null;
  teamB: Team | null;
  prediction: LocalPrediction | undefined;
  locked: boolean;
  onChange: (field: "score_a" | "score_b" | "winner_id", value: any) => void;
  saveStatus?: MatchSaveStatus;
  onLuckyPick?: () => void;
}

export function MatchScoreRow({ match, teamA, teamB, prediction, locked, onChange, saveStatus, onLuckyPick }: Props) {
  const canLucky = !locked && !!teamA && !!teamB && !!onLuckyPick;
  return (
    <div className="rounded-lg border border-border bg-card/50 p-2 sm:p-3">
      {/* Date row (always visible) */}
      <div className="mb-1.5 flex items-center justify-between text-[10px] leading-tight text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{formatMaltaDate(match.match_date)}</span>
          {" · "}
          {formatMaltaTime(match.match_date)} MLT
        </span>
        <span className="flex items-center gap-2">
          <SaveStatusBadge status={saveStatus} />
          {canLucky && (
            <button
              type="button"
              onClick={onLuckyPick}
              title="I'm feeling lucky — auto-pick a plausible result"
              aria-label="Lucky pick"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-primary/15 hover:text-primary"
            >
              <Dices className="h-3.5 w-3.5" />
            </button>
          )}
          {locked && <Lock className="h-3 w-3 shrink-0" />}
        </span>
      </div>

      {/* Match row */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Team A */}
        <div className="flex flex-1 items-center justify-end gap-1.5 min-w-0 sm:gap-2">
          <span className="truncate text-right text-xs font-medium text-foreground sm:text-sm">
            {teamA?.name ?? "TBD"}
          </span>
          <TeamFlag code={teamA?.code} name={teamA?.name} size={24} />
        </div>

        {/* Score */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <ScoreStepper
            value={prediction?.score_a ?? null}
            onChange={(v) => onChange("score_a", v)}
            disabled={locked}
          />
          <span className="text-xs font-bold text-muted-foreground sm:text-base">:</span>
          <ScoreStepper
            value={prediction?.score_b ?? null}
            onChange={(v) => onChange("score_b", v)}
            disabled={locked}
          />
        </div>

        {/* Team B */}
        <div className="flex flex-1 items-center gap-1.5 min-w-0 sm:gap-2">
          <TeamFlag code={teamB?.code} name={teamB?.name} size={24} />
          <span className="truncate text-xs font-medium text-foreground sm:text-sm">
            {teamB?.name ?? "TBD"}
          </span>
        </div>
      </div>
    </div>
  );
}
