import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award, Loader2, Gift } from "lucide-react";

export function PrizesTab() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("settings")
      .select("*")
      .then(({ data }) => {
        const map: Record<string, any> = {};
        for (const s of data ?? []) {
          map[s.key] =
            typeof s.value === "string"
              ? s.value.replace(/^"|"$/g, "")
              : s.value;
        }
        setSettings(map);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const prizes = [
    {
      position: "1st Place",
      prize: settings.prize_1st || "€500",
      icon: Trophy,
      color: "text-gold",
      bg: "bg-gold/10 border-gold/30",
    },
    {
      position: "2nd Place",
      prize: settings.prize_2nd || "—",
      icon: Medal,
      color: "text-muted-foreground",
      bg: "bg-muted/50 border-border",
    },
    {
      position: "3rd Place",
      prize: settings.prize_3rd || "—",
      icon: Award,
      color: "text-chart-4",
      bg: "bg-chart-4/10 border-chart-4/30",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {prizes.map(({ position, prize, icon: Icon, color, bg }) => (
          <Card key={position} className={`${bg} text-center`}>
            <CardContent className="flex flex-col items-center gap-3 p-8">
              <Icon className={`h-10 w-10 ${color}`} />
              <p className="text-sm font-medium text-muted-foreground">{position}</p>
              <p className={`text-3xl font-black ${color}`}>{prize}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {settings.prize_additional && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" /> Additional Prizes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {settings.prize_additional}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
