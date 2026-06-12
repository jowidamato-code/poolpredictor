import { createFileRoute } from "@tanstack/react-router";
import { useAuthContext } from "../__root";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, BookOpen, ClipboardList, Gift, BarChart3 } from "lucide-react";
import { PredictionsTab } from "@/components/tournament/PredictionsTab";
import { RulesTab } from "@/components/tournament/RulesTab";
import { MyPredictionsTab } from "@/components/tournament/MyPredictionsTab";
import { PrizesTab } from "@/components/tournament/PrizesTab";
import { StandingsTab } from "@/components/tournament/StandingsTab";

export const Route = createFileRoute("/_authenticated/tournament")({
  component: TournamentPage,
});

function TournamentPage() {
  const auth = useAuthContext();
  const [deadline, setDeadline] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("settings")
      .select("*")
      .eq("key", "prediction_deadline")
      .single()
      .then(({ data }) => {
        if (data) {
          const val = data.value;
          setDeadline(
            typeof val === "string" ? val.replace(/^"|"$/g, "") : String(val),
          );
        }
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground sm:text-2xl">
          World Cup 2026 Predictor
        </h2>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Predict the full bracket and compete for prizes
        </p>
      </div>

      <Tabs defaultValue="my-predictions" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-5 gap-1 sm:inline-flex sm:w-auto">
          <TabsTrigger
            value="my-predictions"
            className="flex-col gap-0.5 px-1 py-1.5 text-[10px] sm:flex-row sm:gap-1.5 sm:px-3 sm:py-1 sm:text-sm"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span>My Picks</span>
          </TabsTrigger>
          <TabsTrigger
            value="standings"
            className="flex-col gap-0.5 px-1 py-1.5 text-[10px] sm:flex-row sm:gap-1.5 sm:px-3 sm:py-1 sm:text-sm"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Standings</span>
          </TabsTrigger>
          <TabsTrigger
            value="predictions"
            className="flex-col gap-0.5 px-1 py-1.5 text-[10px] sm:flex-row sm:gap-1.5 sm:px-3 sm:py-1 sm:text-sm"
          >
            <Target className="h-3.5 w-3.5" />
            <span>Predictions</span>
          </TabsTrigger>
          <TabsTrigger
            value="prizes"
            className="flex-col gap-0.5 px-1 py-1.5 text-[10px] sm:flex-row sm:gap-1.5 sm:px-3 sm:py-1 sm:text-sm"
          >
            <Gift className="h-3.5 w-3.5" />
            <span>Prizes</span>
          </TabsTrigger>
          <TabsTrigger
            value="rules"
            className="flex-col gap-0.5 px-1 py-1.5 text-[10px] sm:flex-row sm:gap-1.5 sm:px-3 sm:py-1 sm:text-sm"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Rules</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predictions">
          <PredictionsTab userId={auth.user!.id} deadline={deadline} />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab />
        </TabsContent>
        <TabsContent value="my-predictions">
          <MyPredictionsTab userId={auth.user!.id} />
        </TabsContent>
        <TabsContent value="prizes">
          <PrizesTab />
        </TabsContent>
        <TabsContent value="standings">
          <StandingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
