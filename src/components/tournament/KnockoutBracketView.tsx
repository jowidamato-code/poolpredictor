import { Card } from "@/components/ui/card";
import { Lock, ChevronLeft, ChevronRight, Dices, AlertTriangle } from "lucide-react";
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
import { deriveKnockoutTeams, type TiebreakerPick } from "@/lib/knockout-derivation";
import { SaveStatusBadge } from "./SaveStatusBadge";
import type { MatchSaveStatus } from "./PredictionsTab";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  onLuckyPick?: (matchId: string, teamAId: string, teamBId: string) => void;
  onFinalComplete?: () => void;
  tiebreakers?: TiebreakerPick[];
  onResolveTiebreaker?: (pick: TiebreakerPick) => void;
}

export function KnockoutBracketView({
  teams,
  matches,
  predictions,
  localPredictions,
  isLocked,
  onChange,
  saveStatus,
  onLuckyPick,
  onFinalComplete,
  tiebreakers,
  onResolveTiebreaker,
}: Props) {
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
  const { assignments: derived, cutoffTieGroups, best3UsedFallback } = deriveKnockoutTeams(
    teams,
    matches,
    localPredictions,
    tiebreakers ?? [],
  );
  const [tieDialogIdx, setTieDialogIdx] = useState<number | null>(null);
  const [tiePicks, setTiePicks] = useState<Set<string>>(new Set());

  // Only include rounds that actually have matches
  const activeRounds = KNOCKOUT_ROUNDS.filter((r) => matches.some((m) => m.round === r));

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

  const isRoundComplete = (round: string) => {
    const roundMatches = matches.filter((m) => m.round === round);
    return roundMatches.length > 0 && roundMatches.every(isMatchComplete);
  };

  const getFirstPendingRoundIndex = () => {
    const pendingIdx = activeRounds.findIndex((round) => !isRoundComplete(round));
    return pendingIdx === -1 ? 0 : pendingIdx;
  };

  const [activeIdx, setActiveIdx] = useState(getFirstPendingRoundIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCompletionRef = useRef<Record<string, boolean> | null>(null);

  // Auto-advance only when a round becomes complete after this view has opened.
  useEffect(() => {
    const completion = Object.fromEntries(
      activeRounds.map((round) => [round, isRoundComplete(round)]),
    );
    const finalComplete = completion.final ?? false;

    if (!prevCompletionRef.current) {
      prevCompletionRef.current = { ...completion, __final_all: finalComplete };
      return;
    }

    const prevCompletion = prevCompletionRef.current;
    const currentRound = activeRounds[activeIdx];
    let advanceTimer: ReturnType<typeof setTimeout> | undefined;

    if (currentRound) {
      const complete = completion[currentRound] ?? false;
      const wasComplete = prevCompletion[currentRound] ?? false;
      if (complete && !wasComplete && activeIdx < activeRounds.length - 1) {
        // Advance after a brief beat so the user sees their last input land
        advanceTimer = setTimeout(() => {
          setActiveIdx(activeIdx + 1);
          containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 1000);
      }
    }

    // Notify parent only when the Final becomes complete after this view has opened.
    if (finalComplete && !(prevCompletion["__final_all"] ?? false)) {
      onFinalComplete?.();
    }

    prevCompletionRef.current = { ...completion, __final_all: finalComplete };

    return () => {
      if (advanceTimer) clearTimeout(advanceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPredictions, activeIdx]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= activeRounds.length) return;
    setActiveIdx(idx);
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={containerRef} className="pb-4 scroll-mt-4">
      {best3UsedFallback && cutoffTieGroups.length === 0 && (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1 text-xs sm:text-sm">
              <p className="font-semibold text-foreground">
                Best-3rd allocation using fallback
              </p>
              <p className="mt-0.5 text-muted-foreground">
                The qualifying 3rd-place groups didn't match the official FIFA
                allocation table. Round of 32 Best-3rd pairings were filled
                using pool-matching as a safety net.
              </p>
            </div>
          </div>
        </div>
      )}
      {cutoffTieGroups.length > 0 && onResolveTiebreaker && (
        <div className="mb-3 rounded-lg border border-gold/40 bg-gold/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <div className="flex-1 text-xs sm:text-sm">
              <p className="font-semibold text-foreground">
                3rd-place tiebreaker needed
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Some 3rd-place teams are tied on points, goal difference and
                goals scored at the qualification cutoff. Pick which advance to
                fill the Round of 32.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {cutoffTieGroups.map((g, i) => (
                  <Button
                    key={g.tieKey}
                    size="sm"
                    variant="outline"
                    className="border-gold/40 text-gold hover:bg-gold/10"
                    onClick={() => {
                      setTiePicks(new Set());
                      setTieDialogIdx(i);
                    }}
                  >
                    Resolve tie ({g.teams.length} teams, {g.slotsAvailable} slot
                    {g.slotsAvailable === 1 ? "" : "s"})
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
                <div className={cn("flex flex-col gap-3", round === "final" && "items-center")}>
                  {roundMatches.map((m) => {
                    const slot = derived[m.id] ?? {
                      team_a_id: m.team_a_id,
                      team_b_id: m.team_b_id,
                    };
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
                            {!locked && teamA && teamB && onLuckyPick && (
                              <button
                                type="button"
                                onClick={() => onLuckyPick(m.id, teamA.id, teamB.id)}
                                title="I'm feeling lucky — auto-pick a plausible result"
                                aria-label="Lucky pick"
                                className="inline-flex h-5 items-center justify-center gap-1 rounded px-1 text-[10px] text-muted-foreground hover:bg-primary/15 hover:text-primary"
                              >
                                <Dices className="h-3.5 w-3.5" />
                                <span>Auto-Pick</span>
                              </button>
                            )}
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
                            <span className="text-xs font-bold text-muted-foreground sm:text-base">
                              :
                            </span>
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
                              You picked a draw as the match result. Pick which team goes through to the next round:
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

      <Dialog
        open={tieDialogIdx !== null}
        onOpenChange={(o) => {
          if (!o) setTieDialogIdx(null);
        }}
      >
        <DialogContent>
          {tieDialogIdx !== null && cutoffTieGroups[tieDialogIdx] && (() => {
            const tg = cutoffTieGroups[tieDialogIdx];
            const slots = tg.slotsAvailable;
            const canSave = tiePicks.size === slots;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Pick {slots} team{slots === 1 ? "" : "s"} to advance</DialogTitle>
                  <DialogDescription>
                    These 3rd-place teams are tied on points, goal difference and
                    goals scored. Select exactly {slots} to take the remaining
                    Round of 32 slot{slots === 1 ? "" : "s"}.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  {tg.teams.map((t) => {
                    const team = teamMap[t.team_id];
                    const checked = tiePicks.has(t.team_id);
                    const disabled = !checked && tiePicks.size >= slots;
                    return (
                      <button
                        type="button"
                        key={t.team_id}
                        disabled={disabled}
                        onClick={() => {
                          setTiePicks((prev) => {
                            const next = new Set(prev);
                            if (next.has(t.team_id)) next.delete(t.team_id);
                            else next.add(t.team_id);
                            return next;
                          });
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md border p-2 text-left text-sm",
                          checked
                            ? "border-primary bg-primary/15"
                            : "border-border bg-card hover:bg-muted/50",
                          disabled && "opacity-40",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <TeamFlag code={team?.code} name={team?.name} size={20} />
                          <span className="font-medium">{team?.name ?? "?"}</span>
                          <span className="text-xs text-muted-foreground">
                            Group {t.group_name}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t.pts} pts · GD {t.gd >= 0 ? "+" : ""}
                          {t.gd} · {t.gf} GF
                        </span>
                      </button>
                    );
                  })}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTieDialogIdx(null)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={!canSave}
                    onClick={() => {
                      onResolveTiebreaker?.({
                        tieKey: tg.tieKey,
                        advancing: Array.from(tiePicks),
                      });
                      setTieDialogIdx(null);
                    }}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
