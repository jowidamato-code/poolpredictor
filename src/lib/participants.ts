import { supabase } from "@/integrations/supabase/client";

/** Returns the set of user_ids that are admins (and therefore excluded
 * from tournament participation, the prize pot and the standings). */
export async function fetchAdminUserIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  return new Set((data ?? []).map((r: any) => r.user_id as string));
}

/** Counts profiles excluding admins. */
export async function fetchParticipantCount(): Promise<number> {
  const [profilesRes, admins] = await Promise.all([
    supabase.from("profiles").select("user_id"),
    fetchAdminUserIds(),
  ]);
  const profiles = profilesRes.data ?? [];
  return profiles.filter((p: any) => !admins.has(p.user_id)).length;
}