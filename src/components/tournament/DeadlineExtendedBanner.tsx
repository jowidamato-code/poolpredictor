import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "seen-deadline-extended-v1";

export function DeadlineExtendedBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? dismiss() : setOpen(v))}>
      <DialogContent className="border-gold/40 bg-background">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/40">
              <Clock className="h-4 w-4 text-gold" />
            </span>
            <DialogTitle>
              Deadline extended by 2 hours — now 14:00 Malta time
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2 leading-relaxed">
            We identified a bug that locked predictions for some users for
            roughly 12 minutes between 11:00 and 11:12 Malta time. To make up
            for it, we've extended the deadline by 2 hours, to 14:00 Malta
            time. Apologies for the inconvenience — and good luck with your
            predictions!
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            onClick={dismiss}
            className="bg-gold text-background hover:bg-gold/90"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}