import { Loader2, Check, AlertCircle } from "lucide-react";
import type { MatchSaveStatus } from "./PredictionsTab";

export function SaveStatusBadge({ status }: { status?: MatchSaveStatus }) {
  if (!status) return null;
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-[10px] text-primary">
        <Check className="h-3 w-3" />
        Saved
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] text-destructive">
      <AlertCircle className="h-3 w-3" />
      Retry
    </span>
  );
}
