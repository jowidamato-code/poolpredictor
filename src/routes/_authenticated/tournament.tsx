import { createFileRoute } from "@tanstack/react-router";
import { useAuthContext } from "../__root";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, BookOpen, ClipboardList, Gift, BarChart3, HelpCircle } from "lucide-react";
import { PredictionsTab } from "@/components/tournament/PredictionsTab";
import { RulesTab } from "@/components/tournament/RulesTab";
import { FaqTab } from "@/components/tournament/FaqTab";
import { MyPredictionsTab } from "@/components/tournament/MyPredictionsTab";
import { PrizesTab } from "@/components/tournament/PrizesTab";
import { StandingsTab } from "@/components/tournament/StandingsTab";

export const Route = createFileRoute("/_authenticated/tournament")({
  component: TournamentPage,
});

function TournamentPage() {
  const auth = useAuthContext();
  const [deadline, setDeadline] = useState<string | null>(null);
  const [allowLate, setAllowLate] = useState<boolean>(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("*")
      .in("key", ["prediction_deadline", "allow_late_predictions"])
      .then(({ data }) => {
        if (!data) return;
        for (const row of data) {
          const val = (row as any).value;
          if (row.key === "prediction_deadline") {
            setDeadline(
              typeof val === "string" ? val.replace(/^"|"$/g, "") : String(val),
            );
          } else if (row.key === "allow_late_predictions") {
            setAllowLate(val === true || val === "true");
          }
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
        <TabsList className="grid h-auto w-full grid-cols-6 gap-1 sm:inline-flex sm:w-auto">
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
          <TabsTrigger
            value="faqs"
            className="flex-col gap-0.5 px-1 py-1.5 text-[10px] sm:flex-row sm:gap-1.5 sm:px-3 sm:py-1 sm:text-sm"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>FAQs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predictions">
          <PredictionsTab userId={auth.user!.id} deadline={deadline} allowLate={allowLate} />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab />
        </TabsContent>
        <TabsContent value="faqs">
          <FaqTab />
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
