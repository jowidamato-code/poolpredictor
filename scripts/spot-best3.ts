import { createClient } from "@supabase/supabase-js";
import { deriveKnockoutTeams } from "/dev-server/src/lib/knockout-derivation";
import { THIRD_PLACE_ALLOCATION } from "/dev-server/src/lib/third-place-allocation";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const [teamsR, matchesR] = await Promise.all([sb.from("teams").select("*"), sb.from("matches").select("*")]);
const teams = teamsR.data!; const matches = matchesR.data!;
const tn = new Map(teams.map((t:any)=>[t.id, t.name]));
const tg = new Map(teams.map((t:any)=>[t.id, t.group_name]));

// Pick 5 users at random who have group-stage predictions
const { data: users } = await sb.from("profiles").select("user_id, first_name, last_name").limit(200);
const m4d = matches.map((m:any)=>m.round==="group"?m:{...m, team_a_id:null, team_b_id:null});

const SLOT_MATCH: Record<string, string> = { M74:"74", M77:"77", M79:"79", M80:"80", M81:"81", M82:"82", M85:"85", M87:"87" };

let checked = 0, mismatches = 0;
for (const u of users!) {
  if (checked >= 8) break;
  const { data: preds } = await sb.from("predictions").select("*").eq("user_id", u.user_id);
  const { data: bonus } = await sb.from("bonus_predictions").select("group_tiebreakers").eq("user_id", u.user_id).maybeSingle();
  const predMap: any = {};
  for (const p of preds!) predMap[p.match_id] = { winner_id: p.predicted_winner_id, score_a: p.predicted_score_a, score_b: p.predicted_score_b, team_through: p.predicted_team_through };
  const tb = (bonus?.group_tiebreakers as any[]) ?? [];
  const derived = deriveKnockoutTeams(teams, m4d, predMap, [], tb);
  // Find the 8 qualified 3rd-place teams from standings
  const thirds = derived.standings.filter((s:any)=>s.position===3);
  if (thirds.length < 12) continue;

  // Use the derived assignments to inspect M74,77,79,80,81,82,85,87 best3 slot
  const slotMatches: Record<string, any> = {};
  for (const m of matches) if (Object.values(SLOT_MATCH).includes(String(m.match_number))) slotMatches[`M${m.match_number}`] = m;

  // Determine which 8 groups qualified (from derived M74/77/... team_b slots)
  const assignedByMatch: Record<string,string|null> = {};
  for (const [k, m] of Object.entries(slotMatches)) {
    // best3 slot is team_b (second in pair)
    assignedByMatch[k] = derived.assignments[m.id].team_b_id;
  }
  const qualifiedGroups = Object.values(assignedByMatch).map(id => id?tg.get(id!):null).filter(Boolean).sort();
  if (qualifiedGroups.length !== 8) { checked++; continue; }
  const key = qualifiedGroups.join("");
  const expected = THIRD_PLACE_ALLOCATION[key];
  if (!expected) { console.log(`User ${u.first_name} ${u.last_name}: key ${key} NOT IN TABLE`); mismatches++; checked++; continue; }

  let ok = true;
  const detail: string[] = [];
  for (const k of Object.keys(expected) as ("M74"|"M77"|"M79"|"M80"|"M81"|"M82"|"M85"|"M87")[]) {
    const actualTeam = assignedByMatch[k];
    const actualGroup = actualTeam ? tg.get(actualTeam) : null;
    detail.push(`${k}=${actualGroup}(exp ${expected[k]})`);
    if (actualGroup !== expected[k]) ok = false;
  }
  console.log(`${ok?"✓":"✗"} ${u.first_name} ${u.last_name} [${key}] ${detail.join(" ")}`);
  if (!ok) mismatches++;
  checked++;
}
console.log(`\nChecked ${checked} users with complete group predictions; ${mismatches} mismatches.`);
