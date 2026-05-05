import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Star, Lock, Clock } from "lucide-react";

interface Props {
  userId: string;
  isLocked: boolean;
  onCompletionChange?: (complete: boolean) => void;
}

interface AwardsState {
  top_scorer: string;
  golden_ball: string;
  young_player: string;
  most_assists: string;
  submitted_at: string | null;
}

const EMPTY: AwardsState = {
  top_scorer: "",
  golden_ball: "",
  young_player: "",
  most_assists: "",
  submitted_at: null,
};

export function BonusPicksTab({ userId, isLocked, onCompletionChange }: Props) {
  const [state, setState] = useState<AwardsState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const complete =
      !!state.submitted_at &&
      !!state.top_scorer.trim() &&
      !!state.golden_ball.trim() &&
      !!state.young_player.trim() &&
      !!state.most_assists.trim();
    onCompletionChange?.(complete);
  }, [state, onCompletionChange]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data: b } = await (supabase as any)
      .from("bonus_predictions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (b) {
      setState({
        top_scorer: b.top_scorer ?? "",
        golden_ball: b.golden_ball ?? "",
        young_player: b.young_player ?? "",
        most_assists: b.most_assists ?? "",
        submitted_at: b.submitted_at,
      });
    }
    setLoading(false);
  }

  async function save() {
    if (isLocked) return;
    setSaving(true);

    const payload = {
      user_id: userId,
      top_scorer: state.top_scorer || null,
      golden_ball: state.golden_ball || null,
      young_player: state.young_player || null,
      most_assists: state.most_assists || null,
      submitted_at: state.submitted_at ?? new Date().toISOString(),
    };

    await (supabase as any)
      .from("bonus_predictions")
      .upsert(payload, { onConflict: "user_id" });

    await load();
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const fields: Array<{ key: keyof AwardsState; label: string }> = [
    { key: "top_scorer", label: "Top Goalscorer (20 pts)" },
    { key: "golden_ball", label: "Best Player / Golden Ball (15 pts)" },
    { key: "young_player", label: "Best Young Player (10 pts)" },
    { key: "most_assists", label: "Most Assists (10 pts)" },
  ];

  return (
    <div className="space-y-6">
      {state.submitted_at && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Picks first submitted: {new Date(state.submitted_at).toLocaleString()} — used as tiebreaker.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-gold" /> Player Awards
          </CardTitle>
          <CardDescription>
            Type the player's name. Minor spelling mistakes are accepted.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {fields.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                disabled={isLocked}
                value={state[key] as string}
                placeholder="Player name"
                onChange={(e) => setState((s) => ({ ...s, [key]: e.target.value }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {!isLocked ? (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} size="lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Player Awards
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <Lock className="h-4 w-4" /> Player awards are locked.
        </div>
      )}
    </div>
  );
}
