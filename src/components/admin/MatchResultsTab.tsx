import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Sparkles, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeAdminKnockoutAssignments,
  type AdminMatchRow,
  type GroupResultOverride,
} from "@/lib/admin-knockout-assignment";
import type { TiebreakerPick } from "@/lib/knockout-derivation";
import { ROUND_LABELS, KNOCKOUT_ROUNDS } from "@/lib/tournament-utils";

interface TeamRow {
  id: string;
  name: string;
  code: string;
  group_name: string;
}

interface Props {
  matches: AdminMatchRow[];
  teams: TeamRow[];
  onChanged: () => Promise<void> | void;
}

interface DraftRow {
  team_a_id: string;
  team_b_id: string;
  score_a: string;
  score_b: string;
  winner_id: string;
}

const TIEBREAKER_KEY = "third_place_tiebreakers";

export function MatchResultsTab({ matches, teams, onChanged }: Props) {
  const [groupOverrides, setGroupOverrides] = useState<GroupResultOverride[]>([]);
  const [tiebreakers, setTiebreakers] = useState<TiebreakerPick[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [applyingRound, setApplyingRound] = useState<string | null>(null);
  const [savingTb, setSavingTb] = useState(false);
  const [showAllTeams, setShowAllTeams] = useState<Record<string, boolean>>({});

  // Initialize / refresh drafts whenever incoming matches change.
  useEffect(() => {
    const next: Record<string, DraftRow> = {};
    for (const m of matches) {
      next[m.id] = {
        team_a_id: m.team_a_id ?? "",
        team_b_id: m.team_b_id ?? "",
        score_a: m.score_a?.toString() ?? "",
        score_b: m.score_b?.toString() ?? "",
        winner_id: m.winner_id ?? "",
      };
    }
    setDrafts(next);
  }, [matches]);

  useEffect(() => {
    void loadAuxiliary();
  }, []);

  async function loadAuxiliary() {
    const [grRes, settingsRes] = await Promise.all([
      (supabase as any).from("group_results").select("*"),
      supabase
        .from("settings")
        .select("value")
        .eq("key", TIEBREAKER_KEY)
        .maybeSingle(),
    ]);
    setGroupOverrides((grRes.data ?? []) as GroupResultOverride[]);
    const raw = (settingsRes.data as any)?.value;
    if (Array.isArray(raw)) setTiebreakers(raw as TiebreakerPick[]);
    else setTiebreakers([]);
  }

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams],
  );

  const { suggestions, eligible, cutoffTieGroups } = useMemo(
    () =>
      computeAdminKnockoutAssignments(
        teams,
        matches,
        groupOverrides,
        tiebreakers,
      ),
    [teams, matches, groupOverrides, tiebreakers],
  );

  const matchesByRound = useMemo(() => {
    const grouped: Record<string, AdminMatchRow[]> = {};
    for (const m of matches) (grouped[m.round] ??= []).push(m);
    for (const r of Object.keys(grouped)) {
      grouped[r].sort((a, b) => a.match_number - b.match_number);
    }
    return grouped;
  }, [matches]);

  function patchDraft(matchId: string, patch: Partial<DraftRow>) {
    setDrafts((prev) => ({ ...prev, [matchId]: { ...prev[matchId], ...patch } }));
  }

  async function handleSave(match: AdminMatchRow) {
    const d = drafts[match.id];
    if (!d) return;
    const isKnockout = match.round !== "group";
    const scoreA = d.score_a.trim() === "" ? null : parseInt(d.score_a, 10);
    const scoreB = d.score_b.trim() === "" ? null : parseInt(d.score_b, 10);
    const played = scoreA != null && scoreB != null;

    // For knockouts, when scores are level and played, winner_id is required.
    if (isKnockout && played && scoreA === scoreB && !d.winner_id) {
      alert("This knockout ended level — pick who goes through.");
      return;
    }

    let winnerId: string | null = null;
    if (played) {
      if (scoreA! > scoreB!) winnerId = d.team_a_id || match.team_a_id;
      else if (scoreB! > scoreA!) winnerId = d.team_b_id || match.team_b_id;
      else winnerId = d.winner_id || null;
    }

    setSaving(match.id);
    const { error } = await supabase
      .from("matches")
      .update({
        team_a_id: d.team_a_id || null,
        team_b_id: d.team_b_id || null,
        score_a: scoreA,
        score_b: scoreB,
        winner_id: winnerId,
        played,
      })
      .eq("id", match.id);
    setSaving(null);
    if (error) {
      alert("Error: " + error.message);
      return;
    }
    await onChanged();
  }

  async function applyRoundSuggestions(round: string) {
    const rows = matchesByRound[round] ?? [];
    const updates = rows
      .map((m) => {
        const s = suggestions[m.id];
        if (!s) return null;
        // Only apply where DB is currently empty for that slot — manual
        // overrides always win.
        const team_a_id = m.team_a_id ?? s.team_a_id;
        const team_b_id = m.team_b_id ?? s.team_b_id;
        if (team_a_id === m.team_a_id && team_b_id === m.team_b_id) return null;
        return { id: m.id, team_a_id, team_b_id };
      })
      .filter((x): x is { id: string; team_a_id: string | null; team_b_id: string | null } => !!x);
    if (updates.length === 0) return;
    setApplyingRound(round);
    for (const u of updates) {
      const { error } = await supabase
        .from("matches")
        .update({ team_a_id: u.team_a_id, team_b_id: u.team_b_id })
        .eq("id", u.id);
      if (error) {
        alert(`Error applying suggestions: ${error.message}`);
        break;
      }
    }
    setApplyingRound(null);
    await onChanged();
  }

  async function saveTiebreaker(tieKey: string, advancing: string[]) {
    setSavingTb(true);
    const next = tiebreakers.filter((t) => t.tieKey !== tieKey);
    next.push({ tieKey, advancing });
    const { error } = await (supabase as any)
      .from("settings")
      .upsert({ key: TIEBREAKER_KEY, value: next }, { onConflict: "key" });
    setSavingTb(false);
    if (error) {
      alert("Failed to save tiebreaker: " + error.message);
      return;
    }
    setTiebreakers(next);
  }

  // Render helpers ---------------------------------------------------------

  function TeamPicker({
    matchId,
    side,
    value,
    eligibleIds,
    suggestedId,
  }: {
    matchId: string;
    side: "a" | "b";
    value: string;
    eligibleIds: string[];
    suggestedId: string | null;
  }) {
    const showAllKey = `${matchId}:${side}`;
    const showAll = showAllTeams[showAllKey] ?? false;
    const candidates = showAll
      ? teams.slice().sort((x, y) => x.name.localeCompare(y.name))
      : Array.from(new Set(eligibleIds))
          .map((id) => teamMap[id])
          .filter(Boolean)
          .sort((x, y) => x.name.localeCompare(y.name));
    return (
      <div className="flex flex-col gap-1">
        <Select
          value={value || ""}
          onValueChange={(v) =>
            patchDraft(matchId, side === "a" ? { team_a_id: v } : { team_b_id: v })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={suggestedId ? `Suggested: ${teamMap[suggestedId]?.name ?? "?"}` : "TBD"} />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
                {suggestedId === t.id ? "  ★" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
          onClick={() =>
            setShowAllTeams((prev) => ({ ...prev, [showAllKey]: !showAll }))
          }
        >
          {showAll ? "Show eligible only" : "Show all 48 teams"}
        </button>
      </div>
    );
  }

  function renderMatchCard(match: AdminMatchRow) {
    const d = drafts[match.id];
    if (!d) return null;
    const isKnockout = match.round !== "group";
    const teamA = d.team_a_id ? teamMap[d.team_a_id] : null;
    const teamB = d.team_b_id ? teamMap[d.team_b_id] : null;
    const s = suggestions[match.id];
    const el = eligible[match.id];
    const scoreA = d.score_a.trim() === "" ? null : parseInt(d.score_a, 10);
    const scoreB = d.score_b.trim() === "" ? null : parseInt(d.score_b, 10);
    const isDraw =
      scoreA != null && scoreB != null && scoreA === scoreB;

    const winnerCandidates = [d.team_a_id, d.team_b_id]
      .filter((x): x is string => !!x)
      .map((id) => teamMap[id])
      .filter(Boolean);

    return (
      <Card key={match.id}>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] sm:text-xs">
                M{match.match_number}
              </Badge>
              <Badge variant="outline" className="text-[10px] sm:text-xs">
                {ROUND_LABELS[match.round] ?? match.round}
              </Badge>
            </div>
            {match.played && (
              <Badge className="bg-primary/20 text-primary text-[10px] sm:text-xs">Done</Badge>
            )}
          </div>

          {/* Team row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-1 sm:gap-2">
            <div className="min-w-0 text-right">
              {isKnockout ? (
                <TeamPicker
                  matchId={match.id}
                  side="a"
                  value={d.team_a_id}
                  eligibleIds={el?.a ?? []}
                  suggestedId={s?.team_a_id ?? null}
                />
              ) : (
                <span className="truncate text-xs font-medium text-foreground sm:text-sm">
                  {teamA?.name ?? "TBD"}
                </span>
              )}
            </div>
            <Input
              type="number"
              min={0}
              className="h-9 w-12 px-1 text-center sm:w-14"
              value={d.score_a}
              onChange={(e) => patchDraft(match.id, { score_a: e.target.value })}
            />
            <span className="text-muted-foreground">:</span>
            <Input
              type="number"
              min={0}
              className="h-9 w-12 px-1 text-center sm:w-14"
              value={d.score_b}
              onChange={(e) => patchDraft(match.id, { score_b: e.target.value })}
            />
            <div className="min-w-0 text-left">
              {isKnockout ? (
                <TeamPicker
                  matchId={match.id}
                  side="b"
                  value={d.team_b_id}
                  eligibleIds={el?.b ?? []}
                  suggestedId={s?.team_b_id ?? null}
                />
              ) : (
                <span className="truncate text-xs font-medium text-foreground sm:text-sm">
                  {teamB?.name ?? "TBD"}
                </span>
              )}
            </div>
          </div>

          {/* Draw-winner selector for knockouts */}
          {isKnockout && isDraw && (
            <div className="flex items-center gap-2 rounded-md border border-gold/30 bg-gold/5 p-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-gold" />
              <span className="text-xs text-foreground">
                Level after 90 — pick who goes through:
              </span>
              <Select
                value={d.winner_id || ""}
                onValueChange={(v) => patchDraft(match.id, { winner_id: v })}
              >
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {winnerCandidates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => handleSave(match)}
              disabled={saving === match.id}
            >
              {saving === match.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4" /> Save
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function pendingForRound(round: string): number {
    const rows = matchesByRound[round] ?? [];
    let n = 0;
    for (const m of rows) {
      const s = suggestions[m.id];
      if (!s) continue;
      if (!m.team_a_id && s.team_a_id) n++;
      if (!m.team_b_id && s.team_b_id) n++;
    }
    return n;
  }

  // Render -----------------------------------------------------------------

  const allRounds = ["group", ...KNOCKOUT_ROUNDS];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Enter actual match results. Knockout slots auto-fill from the official
        FIFA bracket once group results are in — manual overrides always win.
      </p>

      {/* 3rd-place cutoff tiebreaker, if needed */}
      {cutoffTieGroups.length > 0 && (
        <Card className="border-gold/40 bg-gold/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-gold" />
              Resolve 3rd-place tiebreaker
            </CardTitle>
            <CardDescription>
              Multiple 3rd-place teams are tied at the qualifying cutoff. Pick
              which advance to fill the remaining best-3rd slots.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cutoffTieGroups.map((g) => {
              const current =
                tiebreakers.find((t) => t.tieKey === g.tieKey)?.advancing ?? [];
              return (
                <TiebreakerCard
                  key={g.tieKey}
                  group={g}
                  teamMap={teamMap}
                  current={current}
                  saving={savingTb}
                  onSave={(advancing) => saveTiebreaker(g.tieKey, advancing)}
                />
              );
            })}
          </CardContent>
        </Card>
      )}

      {allRounds.map((round) => {
        const rows = matchesByRound[round] ?? [];
        if (rows.length === 0) return null;
        const pending = round === "group" ? 0 : pendingForRound(round);
        return (
          <section key={round} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {ROUND_LABELS[round] ?? round}
              </h3>
              {pending > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyRoundSuggestions(round)}
                  disabled={applyingRound === round}
                >
                  {applyingRound === round ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-3.5 w-3.5 text-gold" />
                  )}
                  Apply {pending} suggested slot{pending === 1 ? "" : "s"}
                </Button>
              )}
            </div>
            <div className="space-y-2">{rows.map(renderMatchCard)}</div>
          </section>
        );
      })}
    </div>
  );
}

function TiebreakerCard({
  group,
  teamMap,
  current,
  saving,
  onSave,
}: {
  group: { tieKey: string; teams: { team_id: string; group_name: string }[]; slotsAvailable: number };
  teamMap: Record<string, TeamRow>;
  current: string[];
  saving: boolean;
  onSave: (advancing: string[]) => void;
}) {
  const [picks, setPicks] = useState<string[]>(current);
  useEffect(() => setPicks(current), [current.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(id: string) {
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= group.slotsAvailable) return prev;
      return [...prev, id];
    });
  }

  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <p className="mb-2 text-xs text-muted-foreground">
        {group.teams.length} teams tied — pick {group.slotsAvailable} to advance:
      </p>
      <div className="flex flex-wrap gap-2">
        {group.teams.map((t) => {
          const team = teamMap[t.team_id];
          const active = picks.includes(t.team_id);
          return (
            <Button
              key={t.team_id}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => toggle(t.team_id)}
            >
              {team?.name ?? "?"}{" "}
              <span className="text-[10px] opacity-70">({t.group_name})</span>
            </Button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={saving || picks.length !== group.slotsAvailable}
          onClick={() => onSave(picks)}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save tiebreaker
        </Button>
      </div>
    </div>
  );
}