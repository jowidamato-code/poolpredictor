import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2, Settings, Clock, Award, Shield } from "lucide-react";

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
            { key: "points_correct_winner", label: "Correct Match Winner", desc: "Points for guessing the right winner" },
            { key: "points_correct_score", label: "Correct Exact Score", desc: "Bonus for getting the exact score right" },
            { key: "points_correct_group_winner", label: "Correct Group Winner", desc: "Points for predicting who tops the group" },
            { key: "points_correct_group_runner_up", label: "Correct Group Runner-up", desc: "Points for predicting the group runner-up" },
            { key: "points_correct_finalist", label: "Correct Finalist", desc: "Points for predicting a team reaches the final" },
            { key: "points_correct_champion", label: "Correct Champion", desc: "Points for predicting the tournament winner" },
            { key: "points_correct_golden_boot", label: "Correct Golden Boot", desc: "Points for predicting the top scorer" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <Label>{label}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Input
                type="number"
                min={0}
                className="w-20 text-center"
                value={settings[key] ?? ""}
                onChange={(e) => updateSetting(key, parseInt(e.target.value) || 0)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
