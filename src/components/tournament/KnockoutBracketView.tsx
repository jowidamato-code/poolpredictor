import { Card } from "@/components/ui/card";
import { Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TeamFlag } from "./TeamFlag";
import { ScoreStepper } from "./ScoreStepper";
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
import { deriveKnockoutTeams } from "@/lib/knockout-derivation";
import { SaveStatusBadge } from "./SaveStatusBadge";
import type { MatchSaveStatus } from "./PredictionsTab";

interface Props {
  teams: Team[];
  matches: Match[];
  predictions: Record<string, Prediction>;
  localPredictions: Record<string, LocalPrediction>;
  isLocked: boolean;
  onChange: (
    matchId: string,
    field: "score_a" | "score_b" | "winner_id" | "team_through",
    value: any,
  ) => void;
  saveStatus?: Record<string, MatchSaveStatus>;
}

export function KnockoutBracketView({
  teams,
  matches,
  predictions,
  localPredictions,
  isLocked,
  onChange,
  saveStatus,
}: Props) {
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
  const derived = deriveKnockoutTeams(teams, matches, localPredictions);

  // Only include rounds that actually have matches
  const activeRounds = KNOCKOUT_ROUNDS.filter(
    (r) => matches.some((m) => m.round === r),
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCompletionRef = useRef<Record<string, boolean>>({});

  // Helper: a match is "scored" when both scores filled AND, if tied, a team_through is picked
  const isMatchComplete = (m: Match) => {
    const pred = localPredictions[m.id];
    if (pred?.score_a == null || pred?.score_b == null) return false;
    if (pred.score_a === pred.score_b) {
      const slot = derived[m.id] ?? { team_a_id: m.team_a_id, team_b_id: m.team_b_id };
      // Need both teams known + a tiebreaker pick
      if (!slot.team_a_id || !slot.team_b_id) return true;
      return !!pred.team_through;
    }
    return true;
  };

  // Auto-advance when the current round becomes fully complete
  useEffect(() => {
    activeRounds.forEach((round, idx) => {
      const roundMatches = matches.filter((m) => m.round === round);
      if (roundMatches.length === 0) return;
      const complete = roundMatches.every(isMatchComplete);
      const wasComplete = prevCompletionRef.current[round] ?? false;
      if (complete && !wasComplete && idx === activeIdx && idx < activeRounds.length - 1) {
        // Advance after a brief beat so the user sees their last input land
        const t = setTimeout(() => {
          setActiveIdx(idx + 1);
          containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 1000);
        prevCompletionRef.current[round] = complete;
        return () => clearTimeout(t);
      }
      prevCompletionRef.current[round] = complete;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPredictions]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= activeRounds.length) return;
    setActiveIdx(idx);
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={containerRef} className="pb-4 scroll-mt-4">
      {/* Round navigator */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goTo(activeIdx - 1)}
          disabled={activeIdx === 0}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary disabled:opacity-30"
          aria-label="Previous round"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 rounded-md bg-primary/15 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-primary">
          {ROUND_LABELS[activeRounds[activeIdx]]}
        </div>
        <button
          type="button"
          onClick={() => goTo(activeIdx + 1)}
          disabled={activeIdx === activeRounds.length - 1}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary disabled:opacity-30"
          aria-label="Next round"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Dots indicator */}
      <div className="mb-3 flex justify-center gap-1.5">
        {activeRounds.map((r, i) => (
          <button
            key={r}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to ${ROUND_LABELS[r]}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === activeIdx ? "w-6 bg-primary" : "w-1.5 bg-primary/30",
            )}
          />
        ))}
      </div>

      {/* Sliding viewport */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-1000 ease-in-out"
          style={{ transform: `translateX(-${activeIdx * 100}%)` }}
        >
          {activeRounds.map((round) => {
            const roundMatches = matches.filter((m) => m.round === round);
            return (
              <div key={round} className="w-full shrink-0 px-1">
                <div
                  className={cn(
                    "flex flex-col gap-3",
                    round === "final" && "items-center",
                  )}
                >
                  {roundMatches.map((m) => {
                  const slot = derived[m.id] ?? { team_a_id: m.team_a_id, team_b_id: m.team_b_id };
                  const teamA = slot.team_a_id ? teamMap[slot.team_a_id] : null;
                  const teamB = slot.team_b_id ? teamMap[slot.team_b_id] : null;
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
                        "border-border bg-card p-2.5 space-y-1.5 w-full max-w-md",
                        round === "final" && "border-gold/40 bg-gold/5",
                      )}
                    >
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          {formatMaltaDate(m.match_date)} · {formatMaltaTime(m.match_date)} MLT
                        </span>
                        <span className="flex items-center gap-2">
                          <SaveStatusBadge status={saveStatus?.[m.id]} />
                          {locked && <Lock className="h-3 w-3" />}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="flex flex-1 min-w-0 items-center justify-end gap-1.5 sm:gap-2">
                          <span
                            className={cn(
                              "truncate text-right text-xs font-medium sm:text-sm",
                              aWins ? "text-primary font-semibold" : "text-foreground",
                              !teamA && "italic text-muted-foreground",
                            )}
                          >
                            {teamA?.name ?? "TBD"}
                          </span>
                          <TeamFlag code={teamA?.code} name={teamA?.name} size={24} />
                        </div>
                        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                          <ScoreStepper
                            value={scoreA ?? null}
                            onChange={(v) => onChange(m.id, "score_a", v)}
                            disabled={locked || !teamA}
                          />
                          <span className="text-xs font-bold text-muted-foreground sm:text-base">:</span>
                          <ScoreStepper
                            value={scoreB ?? null}
                            onChange={(v) => onChange(m.id, "score_b", v)}
                            disabled={locked || !teamB}
                          />
                        </div>
                        <div className="flex flex-1 min-w-0 items-center gap-1.5 sm:gap-2">
                          <TeamFlag code={teamB?.code} name={teamB?.name} size={24} />
                          <span
                            className={cn(
                              "truncate text-xs font-medium sm:text-sm",
                              bWins ? "text-primary font-semibold" : "text-foreground",
                              !teamB && "italic text-muted-foreground",
                            )}
                          >
                            {teamB?.name ?? "TBD"}
                          </span>
                        </div>
                      </div>

                      {hasScores && scoreA === scoreB && teamA && teamB && (
                        <div className="pt-1">
                          <p className="mb-1 text-[10px] text-muted-foreground">
                            Tied — pick who advances:
                          </p>
                          <div className="flex gap-1">
                            {[teamA, teamB].map((t) => {
                              const picked = pred?.team_through === t.id;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  disabled={locked}
                                  onClick={() => onChange(m.id, "team_through", t.id)}
                                  className={cn(
                                    "flex-1 rounded px-1.5 py-1 text-[10px] font-medium",
                                    picked
                                      ? "bg-primary/20 text-primary"
                                      : "bg-muted hover:bg-muted/80",
                                  )}
                                >
                                  {t.code ?? t.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Bracket teams are auto-filled from your group-stage predictions. As you predict knockout
        winners, the next rounds populate automatically.
      </p>
    </div>
  );
}

