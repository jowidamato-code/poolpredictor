import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Medal, Award, Loader2, Gift, Users, Wallet, Percent } from "lucide-react";
import { computePrizeBreakdown, fmtMoney } from "@/lib/prize-utils";
import { fetchParticipantCount } from "@/lib/participants";

export function PrizesTab() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [participants, setParticipants] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("settings").select("*"),
      fetchParticipantCount(),
    ]).then(([sRes, count]) => {
      const map: Record<string, any> = {};
      for (const s of sRes.data ?? []) {
        map[s.key] = typeof s.value === "string" ? s.value.replace(/^"|"$/g, "") : s.value;
      }
      setSettings(map);
      setParticipants(count);
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

  const b = computePrizeBreakdown(settings, participants);

  const prizeRows = [
    {
      position: "1st Place",
      pct: b.splitPct.first,
      amount: b.prizes.first,
      icon: Trophy,
      color: "text-gold",
      bg: "bg-gold/10 border-gold/30",
    },
    {
      position: "2nd Place",
      pct: b.splitPct.second,
      amount: b.prizes.second,
      icon: Medal,
      color: "text-muted-foreground",
      bg: "bg-muted/50 border-border",
    },
    {
      position: "3rd Place",
      pct: b.splitPct.third,
      amount: b.prizes.third,
      icon: Award,
      color: "text-chart-4",
      bg: "bg-chart-4/10 border-chart-4/30",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Pool summary */}
      <Card className="border-gold/30 bg-gradient-to-br from-gold/10 to-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Wallet className="h-5 w-5 text-gold" /> Live Prize Pool
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            The pot grows with every participant who joins.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Users} label="Participants" value={String(b.participants)} />
          <Stat
            icon={Wallet}
            label="Entry Fee"
            value={fmtMoney(b.entryFee, b.currency)}
          />
          <Stat
            icon={Percent}
            label={`Admin Fee (${b.adminFeePct}%)`}
            value={fmtMoney(b.adminCut, b.currency)}
          />
          <Stat
            icon={Trophy}
            label="Winning Pot"
            value={fmtMoney(b.winningPot, b.currency)}
            highlight
          />
        </CardContent>
      </Card>

      {/* Prize split */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
        {prizeRows.map(({ position, pct, amount, icon: Icon, color, bg }) => (
          <Card key={position} className={`${bg} text-center`}>
            <CardContent className="flex flex-col items-center gap-2 p-4 sm:p-6">
              <Icon className={`h-7 w-7 sm:h-10 sm:w-10 ${color}`} />
              <p className="text-xs font-medium text-muted-foreground sm:text-sm">{position}</p>
              <p className={`text-2xl font-black sm:text-3xl ${color}`}>
                {fmtMoney(amount, b.currency)}
              </p>
              <p className="text-[10px] text-muted-foreground sm:text-xs">
                {pct}% of winning pot
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {settings.prize_additional && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-5 w-5 text-primary" /> Additional Prizes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {settings.prize_additional}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: any;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${highlight ? "border-gold/40 bg-gold/10" : "border-border bg-background"}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {label}
      </div>
      <p
        className={`mt-1 text-lg font-bold sm:text-xl ${highlight ? "text-gold" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
