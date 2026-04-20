import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/bonus-results")({
  component: BonusResultsPage,
});

function BonusResultsPage() {
  const [resultId, setResultId] = useState<string | null>(null);
  const [topScorer, setTopScorer] = useState("");
  const [goldenBall, setGoldenBall] = useState("");
  const [youngPlayer, setYoungPlayer] = useState("");
  const [mostAssists, setMostAssists] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: r } = await (supabase as any)
      .from("bonus_results")
      .select("*")
      .maybeSingle();
    if (r) {
      setResultId(r.id);
      setTopScorer(r.top_scorer ?? "");
      setGoldenBall(r.golden_ball ?? "");
      setYoungPlayer(r.young_player ?? "");
      setMostAssists(r.most_assists ?? "");
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    const payload = {
      top_scorer: topScorer || null,
      golden_ball: goldenBall || null,
      young_player: youngPlayer || null,
      most_assists: mostAssists || null,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Player Award Results</h2>
          <p className="text-sm text-muted-foreground">
            Enter the official player award winners. Group winners and bracket progression
            are derived automatically from match results.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <span className="text-primary">✓ Saved</span>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save Results
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-gold" /> Player Awards (actual winners)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Top Goalscorer</Label>
            <Input value={topScorer} onChange={(e) => setTopScorer(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Golden Ball</Label>
            <Input value={goldenBall} onChange={(e) => setGoldenBall(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Young Player</Label>
            <Input value={youngPlayer} onChange={(e) => setYoungPlayer(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Most Assists</Label>
            <Input value={mostAssists} onChange={(e) => setMostAssists(e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
