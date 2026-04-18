/**
 * Internal: usernames are stored as synthesized emails so Supabase auth works
 * without exposing real email addresses.
 */
export const INTERNAL_EMAIL_DOMAIN = "wcpredictor.local";

export function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase();
  if (u.includes("@")) return u; // already an email
  return `${u}@${INTERNAL_EMAIL_DOMAIN}`;
}
