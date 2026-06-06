import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

const STORAGE_KEY = "seen-tiebreaker-banner-v1";

export function WhatsNewBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable — silently skip
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <div className="relative rounded-lg border border-gold/40 bg-gold/5 p-3 sm:p-4">
      <div className="flex items-start gap-2 pr-6">
        <Sparkles className="h-4 w-4 shrink-0 text-gold mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-semibold text-foreground">
            New: manual tiebreaker picker
          </p>
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
            If two or more teams in a group end up tied even after points, goal difference,
            goals scored, and head-to-head, you can now pick their final order yourself.
            Look for the gold "Resolve tie" button on any group where this applies.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold hover:bg-gold/20"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}