import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2, Settings, Clock, Award, Shield, Gift, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/settings")({
  component: SettingsPage,
});

interface SettingsMap {
  [key: string]: any;
}

function SettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data } = await supabase.from("settings").select("*");
    const map: SettingsMap = {};
    for (const s of data ?? []) {
      map[s.key] = typeof s.value === "string" ? s.value.replace(/^"|"$/g, "") : s.value;
    }
    setSettings(map);
    setLoading(false);
  }

  function updateSetting(key: string, value: any) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function saveSettings() {
    setSaving(true);
    for (const [key, value] of Object.entries(settings)) {
      const jsonValue = typeof value === "string" ? JSON.stringify(value) : value;
      await supabase
        .from("settings")
        .upsert({ key, value: jsonValue }, { onConflict: "key" });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground">Configure tournament rules and scoring</p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <span className="text-primary">✓ Saved</span>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save Settings
            </>
          )}
        </Button>
      </div>

      {/* Tournament Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-primary" /> Tournament Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tournament Name</Label>
            <Input
              value={settings.tournament_name ?? ""}
              onChange={(e) => updateSetting("tournament_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Format</Label>
            <Input
              value={settings.tournament_format ?? ""}
              onChange={(e) => updateSetting("tournament_format", e.target.value)}
              placeholder="e.g. 48_teams"
            />
          </div>
        </CardContent>
      </Card>

      {/* Deadlines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" /> Deadlines
          </CardTitle>
          <CardDescription>Set when predictions lock</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Prediction Deadline</Label>
            <Input
              type="datetime-local"
              value={settings.prediction_deadline ? settings.prediction_deadline.slice(0, 16) : ""}
              onChange={(e) => updateSetting("prediction_deadline", e.target.value ? new Date(e.target.value).toISOString() : "")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Allow Late Predictions</Label>
              <p className="text-xs text-muted-foreground">Let users submit after the deadline</p>
            </div>
            <Switch
              checked={settings.allow_late_predictions === true || settings.allow_late_predictions === "true"}
              onCheckedChange={(checked) => updateSetting("allow_late_predictions", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Scoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-primary" /> Point System
          </CardTitle>
          <CardDescription>Configure how many points each correct prediction is worth</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { group: "Match Level", items: [
              { key: "points_winner_only", label: "Correct Winner only" },
              { key: "points_winner_gd", label: "Correct Winner + Goal Difference" },
              { key: "points_winner_exact_score", label: "Correct Winner + GD + Exact Score" },
              { key: "points_btts_bonus", label: "Both Teams to Score (correct yes/no)" },
              { key: "points_team_through", label: "Knockout: Team to advance" },
            ]},
            { group: "Group Stage", items: [
              { key: "points_group_winner", label: "Correct Group Winner" },
              { key: "points_group_runner_up", label: "Correct Group Runner-up" },
            ]},
            { group: "Team Progression (per team)", items: [
              { key: "points_progression_r16", label: "Reach Round of 16" },
              { key: "points_progression_qf", label: "Reach Quarter-finals" },
              { key: "points_progression_sf", label: "Reach Semi-finals" },
              { key: "points_progression_final", label: "Reach Final" },
              { key: "points_progression_champion", label: "Win the World Cup" },
            ]},
            { group: "Player Awards", items: [
              { key: "points_top_scorer", label: "Top Goalscorer" },
              { key: "points_golden_ball", label: "Best Player (Golden Ball)" },
              { key: "points_young_player", label: "Best Young Player" },
              { key: "points_most_assists", label: "Most Assists" },
            ]},
          ].map(({ group, items }) => (
            <div key={group} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
              {items.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    className="w-20 text-center"
                    value={settings[key] ?? ""}
                    onChange={(e) => updateSetting(key, parseInt(e.target.value) || 0)}
                  />
                </div>
              ))}
              <Separator />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Prizes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gift className="h-5 w-5 text-gold" /> Prizes
          </CardTitle>
          <CardDescription>Configure tournament prizes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "prize_1st", label: "1st Place Prize", placeholder: "e.g. €500" },
            { key: "prize_2nd", label: "2nd Place Prize", placeholder: "e.g. €200" },
            { key: "prize_3rd", label: "3rd Place Prize", placeholder: "e.g. €100" },
            { key: "entry_fee", label: "Entry Fee", placeholder: "e.g. €20" },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-center justify-between">
              <Label>{label}</Label>
              <Input
                className="w-40"
                placeholder={placeholder}
                value={settings[key] ?? ""}
                onChange={(e) => updateSetting(key, e.target.value)}
              />
            </div>
          ))}
          <Separator />
          <div className="space-y-2">
            <Label>Additional Prize Info</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Any additional prize details or rules..."
              value={settings.prize_additional ?? ""}
              onChange={(e) => updateSetting("prize_additional", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
