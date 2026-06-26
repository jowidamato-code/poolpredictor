import { createClient } from "@supabase/supabase-js";
import { deriveKnockoutTeams } from "/dev-server/src/lib/knockout-derivation";
import { deriveKnockoutTeams as deriveOld } from "/dev-server/scripts/knockout-derivation-old";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const UID = "559bde92-adb9-4805-825d-c1937d972782";

const [teamsR, matchesR, predsR, bonusR] = await Promise.all([
  supabase.from("teams").select("*"),
  supabase.from("matches").select("*"),
  supabase.from("predictions").select("*").eq("user_id", UID),
  supabase.from("bonus_predictions").select("group_tiebreakers").eq("user_id", UID).maybeSingle(),
]);

const teams = teamsR.data!; const matches = matchesR.data!;
const tn = new Map(teams.map((t: any) => [t.id, t.name]));
const predMap: any = {};
for (const p of predsR.data!) predMap[p.match_id] = { winner_id: p.predicted_winner_id, score_a: p.predicted_score_a, score_b: p.predicted_score_b, team_through: p.predicted_team_through };
const tb = (bonusR.data?.group_tiebreakers as any[]) ?? [];
const m4d = matches.map((m: any) => m.round === "group" ? m : { ...m, team_a_id: null, team_b_id: null });

const a = deriveKnockoutTeams(teams, m4d, predMap, [], tb);
const b = deriveOld(teams, m4d, predMap, [], tb);
const T = (id: any) => id ? tn.get(id) ?? id.slice(0,6) : "—";
for (const m of matches.sort((x: any, y: any) => x.match_number - y.match_number)) {
  if (m.round === "group" || m.round === "round_of_32") continue;
  const oa = b.assignments[m.id], na = a.assignments[m.id];
  const same = oa.team_a_id === na.team_a_id && oa.team_b_id === na.team_b_id;
  console.log(`M${m.match_number} ${m.round}: OLD ${T(oa.team_a_id)} v ${T(oa.team_b_id)} | NEW ${T(na.team_a_id)} v ${T(na.team_b_id)} ${same ? "" : "★"}`);
}
