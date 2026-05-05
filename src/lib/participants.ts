import { supabase } from "@/integrations/supabase/client";

/** Returns the set of user_ids that are admins (used for admin-only UI badges). */
export async function fetchAdminUserIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  return new Set((data ?? []).map((r: any) => r.user_id as string));
}

/** Returns the set of user_ids excluded from the public tournament:
 *  admins and test users. They are hidden from standings, prize pot,
 *  and participant counts. */
export async function fetchExcludedUserIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "test_user"] as any);
  return new Set((data ?? []).map((r: any) => r.user_id as string));
}

/** Counts profiles excluding admins and test users. */
export async function fetchParticipantCount(): Promise<number> {
  const [profilesRes, excluded] = await Promise.all([
    supabase.from("profiles").select("user_id"),
    fetchExcludedUserIds(),
  ]);
  const profiles = profilesRes.data ?? [];
  return profiles.filter((p: any) => !excluded.has(p.user_id)).length;
}
