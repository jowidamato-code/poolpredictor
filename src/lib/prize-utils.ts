export interface PrizeBreakdown {
  participants: number;
  entryFee: number;
  adminFeePerEntry: number;
  splitPct: { first: number; second: number; third: number };
  totalPool: number;
  adminCut: number;
  winningPot: number;
  prizes: { first: number; second: number; third: number };
  currency: string;
}

function num(v: any, fallback: number): number {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

export function computePrizeBreakdown(
  settings: Record<string, any>,
  participants: number,
): PrizeBreakdown {
  const entryFee = num(settings.entry_fee_amount ?? settings.entry_fee, 20);
  // Backwards-compat: if old percentage setting exists and the new amount is unset,
  // derive a per-entry amount from the old percentage.
  const legacyPct = settings.admin_fee_pct != null && settings.admin_fee_pct !== "" ? num(settings.admin_fee_pct, 0) : null;
  const adminFeePerEntry = settings.admin_fee_amount != null && settings.admin_fee_amount !== ""
    ? num(settings.admin_fee_amount, 0)
    : legacyPct != null
      ? entryFee * (legacyPct / 100)
      : 2;
  const first = num(settings.prize_split_1st, 50);
  const second = num(settings.prize_split_2nd, 30);
  const third = num(settings.prize_split_3rd, 20);
  const currency = (settings.currency ?? "€") as string;

  const totalPool = entryFee * participants;
  const adminCut = adminFeePerEntry * participants;
  const winningPot = totalPool - adminCut;

  return {
    participants,
    entryFee,
    adminFeePerEntry,
    splitPct: { first, second, third },
    totalPool,
    adminCut,
    winningPot,
    prizes: {
      first: winningPot * (first / 100),
      second: winningPot * (second / 100),
      third: winningPot * (third / 100),
    },
    currency,
  };
}

export function fmtMoney(amount: number, currency = "€"): string {
  const rounded = Math.round(amount * 100) / 100;
  const isInt = rounded === Math.round(rounded);
  return `${currency}${isInt ? rounded.toFixed(0) : rounded.toFixed(2)}`;
}
