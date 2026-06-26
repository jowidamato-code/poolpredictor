import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const sql = readFileSync("/tmp/remap/apply.sql", "utf8");
const stmts = sql.split("\n").filter(Boolean);
console.log(`Applying ${stmts.length} updates...`);

let ok = 0, fail = 0;
for (const stmt of stmts) {
  // Parse: UPDATE predictions SET <sets> WHERE user_id='..' AND match_id='..';
  const m = stmt.match(/^UPDATE predictions SET (.+) WHERE user_id='([^']+)' AND match_id='([^']+)';$/);
  if (!m) { console.error("Bad parse:", stmt); fail++; continue; }
  const [_, sets, user_id, match_id] = m;
  const update = {};
  for (const part of sets.split(", ")) {
    const mm = part.match(/^(\w+) = (NULL|'([^']+)')$/);
    if (!mm) { console.error("Bad set parse:", part); fail++; continue; }
    update[mm[1]] = mm[2] === "NULL" ? null : mm[3];
  }
  const { error } = await sb.from("predictions").update(update).eq("user_id", user_id).eq("match_id", match_id);
  if (error) { console.error("Fail:", user_id, match_id, error.message); fail++; }
  else ok++;
}
console.log(`Done. ok=${ok} fail=${fail}`);
