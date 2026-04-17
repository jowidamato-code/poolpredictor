import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  className?: string;
  max?: number;
}

/**
 * Score stepper: cycles blank → 0 → 1 → 2 → ... with up/down arrows.
 * Up arrow on top, value in middle, down arrow on bottom.
 */
export function ScoreStepper({
  value,
  onChange,
  disabled,
  className,
  max = 20,
}: Props) {
  function increment() {
    if (disabled) return;
    if (value == null) onChange(0);
    else if (value < max) onChange(value + 1);
  }
  function decrement() {
    if (disabled) return;
    if (value == null) return;
    if (value === 0) onChange(null);
    else onChange(value - 1);
  }

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center select-none rounded-md border border-input bg-background",
        disabled && "opacity-50",
        className,
      )}
    >
      <button
        type="button"
        onClick={increment}
        disabled={disabled}
        aria-label="Increase score"
        className="flex h-5 w-10 items-center justify-center rounded-t-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary disabled:cursor-not-allowed"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <div className="flex h-8 w-10 items-center justify-center text-base font-bold tabular-nums text-foreground">
        {value ?? "–"}
      </div>
      <button
        type="button"
        onClick={decrement}
        disabled={disabled}
        aria-label="Decrease score"
        className="flex h-5 w-10 items-center justify-center rounded-b-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary disabled:cursor-not-allowed"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}
