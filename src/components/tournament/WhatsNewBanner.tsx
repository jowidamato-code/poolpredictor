import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "seen-tiebreaker-banner-v1";

export function WhatsNewBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      // localStorage unavailable — silently skip
    }
  }, []);

  const dismissPermanently = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-gold/40 bg-background">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/40">
              <Sparkles className="h-4 w-4 text-gold" />
            </span>
            <DialogTitle>New: manual tiebreaker picker</DialogTitle>
          </div>
          <DialogDescription className="pt-2 leading-relaxed">
            If two or more teams in a group end up tied even after points, goal
            difference, goals scored, and head-to-head, you can now pick their
            final order yourself. Look for the gold "Resolve tie" button on any
            group where this applies.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={dismissPermanently}
          >
            Never show again
          </Button>
          <Button
            type="button"
            onClick={() => setOpen(false)}
            className="bg-gold text-background hover:bg-gold/90"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}