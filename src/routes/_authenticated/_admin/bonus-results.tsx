import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Star, Check, X, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/bonus-results")({
  component: BonusResultsPage,
});

const AWARDS = [
  { key: "top_scorer", label: "Top Goalscorer" },
  { key: "golden_ball", label: "Golden Ball" },
  { key: "young_player", label: "Young Player" },
  { key: "most_assists", label: "Most Assists" },
] as const;

type AwardKey = (typeof AWARDS)[number]["key"];
type Verdict = "won" | "lost";

interface UserPick {
  user_id: string;
  name: string;
  picks: Record<AwardKey, string>;
  verdicts: Record<AwardKey, Verdict | undefined>;
}

function BonusResultsPage() {
  const [resultId, setResultId] = useState<string | null>(null);
  const [official, setOfficial] = useState<Record<AwardKey, string>>({
    top_scorer: "",
    golden_ball: "",
    young_player: "",
    most_assists: "",
  });
  const [users, setUsers] = useState<UserPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [resR, predsR, profilesR, verdictsR] = await Promise.all([
      (supabase as any).from("bonus_results").select("*").maybeSingle(),
      (supabase as any).from("bonus_predictions").select("*"),
      supabase.from("profiles").select("user_id, first_name, last_name"),
      (supabase as any).from("bonus_award_verdicts").select("*"),
    ]);

    if (resR.data) {
      setResultId(resR.data.id);
      setOfficial({
        top_scorer: resR.data.top_scorer ?? "",
        golden_ball: resR.data.golden_ball ?? "",
        young_player: resR.data.young_player ?? "",
        most_assists: resR.data.most_assists ?? "",
      });
    }

    const profileMap: Record<string, { first_name: string; last_name: string }> = {};
    for (const p of profilesR.data ?? []) profileMap[p.user_id] = p;

    const verdictMap: Record<string, Record<AwardKey, Verdict>> = {};
    for (const v of (verdictsR.data ?? []) as any[]) {
      (verdictMap[v.user_id] ??= {} as any)[v.award as AwardKey] = v.verdict;
    }

    const list: UserPick[] = [];
    for (const bp of (predsR.data ?? []) as any[]) {
      const prof = profileMap[bp.user_id];
      if (!prof) continue;
      const picks: Record<AwardKey, string> = {
        top_scorer: bp.top_scorer ?? "",
        golden_ball: bp.golden_ball ?? "",
        young_player: bp.young_player ?? "",
        most_assists: bp.most_assists ?? "",
      };
      const hasAny = AWARDS.some((a) => picks[a.key].trim().length > 0);
      if (!hasAny) continue;
      list.push({
        user_id: bp.user_id,
        name: `${prof.first_name} ${prof.last_name}`.trim(),
        picks,
        verdicts: (verdictMap[bp.user_id] ?? {}) as Record<AwardKey, Verdict | undefined>,
      });
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    setUsers(list);
    setLoading(false);
  }

  async function saveOfficial() {
    setSaving(true);
    const payload = {
      top_scorer: official.top_scorer || null,
      golden_ball: official.golden_ball || null,
      young_player: official.young_player || null,
      most_assists: official.most_assists || null,
    };
    if (resultId) {
      await (supabase as any).from("bonus_results").update(payload).eq("id", resultId);
    } else {
      const { data } = await (supabase as any)
        .from("bonus_results")
        .insert(payload)
        .select()
        .single();
      if (data) setResultId(data.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function setVerdict(userId: string, award: AwardKey, verdict: Verdict | null) {
    if (verdict === null) {
      await (supabase as any)
        .from("bonus_award_verdicts")
        .delete()
        .eq("user_id", userId)
        .eq("award", award);
    } else {
      await (supabase as any)
        .from("bonus_award_verdicts")
        .upsert(
          { user_id: userId, award, verdict },
          { onConflict: "user_id,award" },
        );
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === userId
          ? { ...u, verdicts: { ...u.verdicts, [award]: verdict ?? undefined } }
          : u,
      ),
    );
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
      <div>
        <h2 className="text-2xl font-bold text-foreground">Player Award Results</h2>
        <p className="text-sm text-muted-foreground">
          Record the official winners for reference, then mark each user's pick as WON or LOST. The verdicts drive scoring.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-gold" /> Official winners (reference)
            </CardTitle>
            <CardDescription>For your own bookkeeping. Scoring uses the verdicts below.</CardDescription>
          </div>
          <Button onClick={saveOfficial} disabled={saving} size="sm">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <span className="text-primary">✓ Saved</span>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {AWARDS.map((a) => (
            <div key={a.key} className="space-y-1">
              <Label className="text-xs">{a.label}</Label>
              <Input
                value={official[a.key]}
                onChange={(e) => setOfficial((s) => ({ ...s, [a.key]: e.target.value }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User picks — mark each as WON or LOST</CardTitle>
          <CardDescription>
            Changes save instantly. Unmarked picks fall back to a case-insensitive text match against the official winner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No users have submitted player award picks yet.
            </p>
          ) : (
            users.map((u) => (
              <div key={u.user_id} className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 font-medium text-foreground">{u.name}</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {AWARDS.map((a) => {
                    const pick = u.picks[a.key];
                    const v = u.verdicts[a.key];
                    if (!pick.trim()) {
                      return (
                        <div
                          key={a.key}
                          className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
                        >
                          <div className="font-medium">{a.label}</div>
                          <div className="italic">No pick</div>
                        </div>
                      );
                    }
                    return (
                      <div key={a.key} className="rounded-md border border-border bg-muted/30 px-3 py-2">
                        <div className="mb-2 flex items-center justify-between">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">{a.label}</div>
                            <div className="text-sm font-semibold text-foreground">{pick}</div>
                          </div>
                          {v && (
                            <Badge variant={v === "won" ? "default" : "secondary"} className="text-[10px]">
                              {v.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={v === "won" ? "default" : "outline"}
                            className="h-7 flex-1 text-xs"
                            onClick={() => setVerdict(u.user_id, a.key, "won")}
                          >
                            <Check className="h-3 w-3" /> Won
                          </Button>
                          <Button
                            size="sm"
                            variant={v === "lost" ? "destructive" : "outline"}
                            className="h-7 flex-1 text-xs"
                            onClick={() => setVerdict(u.user_id, a.key, "lost")}
                          >
                            <X className="h-3 w-3" /> Lost
                          </Button>
                          {v && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setVerdict(u.user_id, a.key, null)}
                              title="Clear verdict"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}