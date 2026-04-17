import { flagUrl } from "@/lib/team-flags";
import { cn } from "@/lib/utils";

interface Props {
  code: string | null | undefined;
  name?: string | null;
  size?: number;
  className?: string;
}

export function TeamFlag({ code, name, size = 24, className }: Props) {
  const url = flagUrl(code ?? undefined, size > 40 ? 80 : 40);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={name ?? code ?? "TBD"}
    >
      {url ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="text-[9px] font-bold text-muted-foreground">
          {code ?? "?"}
        </span>
      )}
    </span>
  );
}
