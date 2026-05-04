import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches ALL rows from a table, paginating past Supabase's 1000-row default
 * limit. Use whenever a query is expected to return rows for many users.
 */
export async function fetchAllRows<T = any>(
  table: string,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  // Hard upper bound to avoid infinite loops on unexpected responses.
  for (let i = 0; i < 100; i++) {
    const to = from + pageSize - 1;
    const { data, error } = await (supabase as any)
      .from(table)
      .select("*")
      .range(from, to);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}