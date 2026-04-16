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
        <h2 className="text-2xl font-bold text-foreground">
          World Cup 2026 Predictor
        </h2>
        <p className="text-sm text-muted-foreground">
          Predict the full bracket and compete for prizes
        </p>
      </div>

      <Tabs defaultValue="predictions" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="predictions" className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> Predictions
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Rules
          </TabsTrigger>
          <TabsTrigger value="my-predictions" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> My Picks
          </TabsTrigger>
          <TabsTrigger value="prizes" className="gap-1.5">
            <Gift className="h-3.5 w-3.5" /> Prizes
          </TabsTrigger>
          <TabsTrigger value="standings" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Standings
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
