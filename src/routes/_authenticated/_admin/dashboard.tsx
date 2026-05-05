import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createServerFn } from "@tanstack/react-start";
import { adminResetPasswordFn } from "@/lib/admin-users.functions";
import { requireAdmin } from "@/lib/admin-middleware";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Loader2,
  Check,
  Trash2,
  KeyRound,
  ListChecks,
  Settings as SettingsIcon,
  Shield,
  Dices,
} from "lucide-react";
import { GroupResultsTab } from "@/components/admin/GroupResultsTab";

export const Route = createFileRoute("/_authenticated/_admin/dashboard")({
  component: AdminDashboard,
});

const createUserFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: {
    firstName: string;
    lastName: string;
    username: string;
    password: string;
    accountType: "admin" | "user" | "test_user";
  }) => {
    if (!input.username.trim()) throw new Error("Username is required");
    if (input.username.length > 50) throw new Error("Username too long");
    if (input.password.length < 6) throw new Error("Password must be at least 6 characters");
    if (input.password.length > 200) throw new Error("Password too long");
    if (input.firstName.length > 100 || input.lastName.length > 100) {
      throw new Error("Name too long");
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(input.username)) {
      throw new Error("Username can only contain letters, numbers, '.', '_' and '-'");
    }
    if (input.accountType !== "admin" && input.accountType !== "user" && input.accountType !== "test_user") {
      throw new Error("Invalid account type");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cleanUsername = data.username.trim();
    const cleanFirst = data.firstName.trim();
    const cleanLast = data.lastName.trim();
    const email = `${cleanUsername.toLowerCase()}@wcpredictor.local`;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username: cleanUsername,
        first_name: cleanFirst,
        last_name: cleanLast,
      },
    });
    if (error || !created?.user) {
      throw new Error(error?.message ?? "Failed to create user");
    }
    const userId = created.user.id;

    // Belt-and-braces: ensure a profile row exists even if the trigger
    // did not fire or partially failed.
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          username: cleanUsername,
          first_name: cleanFirst,
          last_name: cleanLast,
        },
        { onConflict: "user_id" },
      );
    if (profileErr) {
      // Roll back the auth user so the admin can retry cleanly.
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Profile creation failed: ${profileErr.message}`);
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: data.accountType },
        { onConflict: "user_id,role" },
      );
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Role assignment failed: ${roleErr.message}`);
    }

    return { userId, email, username: cleanUsername };
  });

const deleteUserFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { userId: string }) => {
    if (!input.userId || typeof input.userId !== "string") {
      throw new Error("Invalid user id");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

interface UserProfile {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
}

function AdminDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [testUserIds, setTestUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState<{
    firstName: string;
    lastName: string;
    username: string;
    password: string;
    accountType: "admin" | "user" | "test_user";
  }>({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    accountType: "user",
  });
  const [addingUser, setAddingUser] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  // Password reset
  const [resetUser, setResetUser] = useState<UserProfile | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  // Match result management
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [updatingMatch, setUpdatingMatch] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<Record<string, { score_a: string; score_b: string; winner_id: string }>>({});

  // Team strength editing
  const [teamStrengths, setTeamStrengths] = useState<Record<string, string>>({});
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadData() {
    const [profilesRes, matchesRes, teamsRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("matches").select("*").order("match_number"),
      supabase.from("teams").select("*").order("name"),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "test_user"] as any),
    ]);
    setUsers(profilesRes.data ?? []);
    const allRoles = (rolesRes.data ?? []) as any[];
    setAdminIds(new Set(allRoles.filter((r) => r.role === "admin").map((r) => r.user_id)));
    setTestUserIds(new Set(allRoles.filter((r) => r.role === "test_user").map((r) => r.user_id)));
    setMatches(matchesRes.data ?? []);
    setTeams(teamsRes.data ?? []);

    const strengths: Record<string, string> = {};
    for (const t of (teamsRes.data ?? []) as any[]) {
      strengths[t.id] = (t.strength ?? 50).toString();
    }
    setTeamStrengths(strengths);

    const results: Record<string, any> = {};
    for (const m of matchesRes.data ?? []) {
      results[m.id] = {
        score_a: m.score_a?.toString() ?? "",
        score_b: m.score_b?.toString() ?? "",
        winner_id: m.winner_id ?? "",
      };
    }
    setMatchResults(results);
    setLoading(false);
  }

  async function handleAddUser() {
    setAddError("");
    setAddSuccess("");
    setAddingUser(true);
    try {
      const headers = await authHeaders();
      const result = await createUserFn({ data: newUser, headers });
      setAddSuccess(
        `${newUser.accountType === "admin" ? "Admin" : newUser.accountType === "test_user" ? "Test user" : "Participant"} created! Username to sign in: "${result.username}"`,
      );
      setNewUser({
        firstName: "",
        lastName: "",
        username: "",
        password: "",
        accountType: "user",
      });
      await loadData();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddingUser(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const headers = await authHeaders();
      await deleteUserFn({ data: { userId }, headers });
      await loadData();
    } catch (err: any) {
      alert("Failed to delete user: " + err.message);
    }
  }

  function openResetDialog(user: UserProfile) {
    setResetUser(user);
    setResetPw("");
    setResetError("");
    setResetSuccess("");
  }

  async function handleResetPassword() {
    if (!resetUser) return;
    setResetError("");
    setResetSuccess("");
    if (resetPw.length < 6) {
      setResetError("Password must be at least 6 characters");
      return;
    }
    setResetting(true);
    try {
      const headers = await authHeaders();
      await adminResetPasswordFn({
        data: { userId: resetUser.user_id, newPassword: resetPw },
        headers,
      });
      setResetSuccess(`Password reset for @${resetUser.username}`);
      setResetPw("");
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password");
    } finally {
      setResetting(false);
    }
  }

  async function handleUpdateMatchResult(matchId: string) {
    setUpdatingMatch(matchId);
    const result = matchResults[matchId];
    const { error } = await supabase.from("matches").update({
      score_a: result.score_a ? parseInt(result.score_a) : null,
      score_b: result.score_b ? parseInt(result.score_b) : null,
      winner_id: result.winner_id || null,
      played: !!(result.score_a && result.score_b),
    }).eq("id", matchId);

    if (error) alert("Error: " + error.message);
    setUpdatingMatch(null);
    await loadData();
  }

  async function handleUpdateTeamStrength(teamId: string) {
    const raw = teamStrengths[teamId];
    const value = parseInt(raw, 10);
    if (Number.isNaN(value) || value < 1 || value > 100) {
      alert("Strength must be a number between 1 and 100");
      return;
    }
    setSavingTeamId(teamId);
    const { error } = await supabase.from("teams").update({ strength: value }).eq("id", teamId);
    setSavingTeamId(null);
    if (error) {
      alert("Error: " + error.message);
      return;
    }
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, strength: value } : t)));
  }

  const teamMap = Object.fromEntries(teams.map((t: any) => [t.id, t]));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto sm:grid-cols-none">
          <TabsTrigger value="users" className="text-xs sm:text-sm">Users</TabsTrigger>
          <TabsTrigger value="results" className="text-xs sm:text-sm">Match Results</TabsTrigger>
          <TabsTrigger value="groups" className="text-xs sm:text-sm">Group Results</TabsTrigger>
          <TabsTrigger value="teams" className="text-xs sm:text-sm">Teams</TabsTrigger>
          <TabsTrigger value="predictions" className="text-xs sm:text-sm">Predictions</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {users.length} registered ·{" "}
              {users.filter((u) => !adminIds.has(u.user_id)).length} participants ·{" "}
              {users.filter((u) => adminIds.has(u.user_id)).length} admins
            </p>
            <Button onClick={() => setShowAddUser(!showAddUser)}>
              <Plus className="h-4 w-4" /> Add User
            </Button>
          </div>

          {showAddUser && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Create New User</CardTitle>
                <CardDescription>Add a user with their login credentials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {addError && (
                  <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{addError}</div>
                )}
                {addSuccess && (
                  <div className="rounded-md bg-primary/10 px-4 py-3 text-sm text-primary">{addSuccess}</div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={newUser.username}
                    placeholder="e.g. johndoe"
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Letters, numbers, '.', '_' and '-' only. This is what they'll use to log in.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={newUser.password}
                    placeholder="At least 6 characters"
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account type</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={newUser.accountType === "user" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setNewUser({ ...newUser, accountType: "user" })}
                    >
                      Participant
                    </Button>
                    <Button
                      type="button"
                      variant={newUser.accountType === "admin" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setNewUser({ ...newUser, accountType: "admin" })}
                    >
                      Admin
                    </Button>
                    <Button
                      type="button"
                      variant={newUser.accountType === "test_user" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setNewUser({ ...newUser, accountType: "test_user" })}
                    >
                      Test user
                    </Button>
                  </div>
                  {newUser.accountType === "test_user" && (
                    <p className="text-xs text-muted-foreground">
                      Test users can use the app like a participant but are excluded from standings, the prize pot, and participant counts.
                    </p>
                  )}
                </div>
                <Button onClick={handleAddUser} disabled={addingUser}>
                  {addingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Create User
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {users.map((user) => {
              const isAdminUser = adminIds.has(user.user_id);
              const isTestUser = testUserIds.has(user.user_id);
              const roleLabel = isAdminUser ? "Admin" : isTestUser ? "Test" : "Participant";
              return (
              <Card key={user.user_id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isAdminUser ? "bg-gold/15" : isTestUser ? "bg-muted/40" : "bg-primary/10"}`}>
                      {isAdminUser ? (
                        <Shield className="h-5 w-5 text-gold" />
                      ) : (
                        <Users className={`h-5 w-5 ${isTestUser ? "text-muted-foreground" : "text-primary"}`} />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">
                          {user.first_name} {user.last_name}
                        </p>
                        <Badge
                          variant={isAdminUser ? "default" : "secondary"}
                          className={`text-[10px] ${isAdminUser ? "bg-gold/20 text-gold hover:bg-gold/20" : isTestUser ? "border border-muted-foreground/30 bg-muted/30 text-muted-foreground" : ""}`}
                        >
                          {roleLabel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openResetDialog(user)}
                      title="Reset password"
                    >
                      <KeyRound className="mr-1 h-4 w-4" /> Reset
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.user_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-3">
          <p className="text-sm text-muted-foreground">Enter actual match results to update the standings</p>
          {matches.map((match: any) => {
            const teamA = match.team_a_id ? teamMap[match.team_a_id] : null;
            const teamB = match.team_b_id ? teamMap[match.team_b_id] : null;
            const result = matchResults[match.id];

            return (
              <Card key={match.id}>
                <CardContent className="space-y-3 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px] sm:text-xs">{match.round}</Badge>
                    {match.played && <Badge className="bg-primary/20 text-primary text-[10px] sm:text-xs">Done</Badge>}
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-1 sm:gap-2">
                    <span className="truncate text-right text-xs font-medium text-foreground sm:text-sm">
                      {teamA?.name ?? "TBD"}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      className="h-9 w-12 px-1 text-center sm:w-14"
                      value={result?.score_a ?? ""}
                      onChange={(e) =>
                        setMatchResults((prev) => ({
                          ...prev,
                          [match.id]: { ...prev[match.id], score_a: e.target.value },
                        }))
                      }
                    />
                    <span className="text-muted-foreground">:</span>
                    <Input
                      type="number"
                      min={0}
                      className="h-9 w-12 px-1 text-center sm:w-14"
                      value={result?.score_b ?? ""}
                      onChange={(e) =>
                        setMatchResults((prev) => ({
                          ...prev,
                          [match.id]: { ...prev[match.id], score_b: e.target.value },
                        }))
                      }
                    />
                    <span className="truncate text-xs font-medium text-foreground sm:text-sm">
                      {teamB?.name ?? "TBD"}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateMatchResult(match.id)}
                      disabled={updatingMatch === match.id}
                    >
                      {updatingMatch === match.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4" /> Save
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="groups">
          <GroupResultsTab />
        </TabsContent>

        <TabsContent value="teams" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Dices className="h-5 w-5 text-primary" /> Team Strength Ratings
              </CardTitle>
              <CardDescription>
                Rate each team from 1 (weakest) to 100 (strongest). The
                "I'm feeling lucky" auto-pick uses these to generate realistic
                scorelines (e.g. Brazil vs Curaçao won't roll a Curaçao win).
              </CardDescription>
            </CardHeader>
          </Card>
          {[...new Set(teams.map((t: any) => t.group_name))].sort().map((g) => (
            <Card key={g as string}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-primary">Group {g as string}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teams
                  .filter((t: any) => t.group_name === g)
                  .sort((a: any, b: any) => a.name.localeCompare(b.name))
                  .map((t: any) => (
                    <div key={t.id} className="flex items-center gap-3">
                      <span className="flex-1 truncate text-sm font-medium text-foreground">
                        {t.name}{" "}
                        <span className="text-xs text-muted-foreground">({t.code})</span>
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        className="h-8 w-20 text-center"
                        value={teamStrengths[t.id] ?? ""}
                        onChange={(e) =>
                          setTeamStrengths((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateTeamStrength(t.id)}
                        disabled={savingTeamId === t.id}
                      >
                        {savingTeamId === t.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="predictions">
          <Card>
            <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" /> User Predictions
                </p>
                <p className="text-sm text-muted-foreground">
                  View every user's submissions and export them as CSV.
                </p>
              </div>
              <Button asChild>
                <Link to="/predictions">Open</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4 text-primary" /> Tournament Settings
                </p>
                <p className="text-sm text-muted-foreground">
                  Configure deadline, scoring, prize pool and entry fees.
                </p>
              </div>
              <Button asChild>
                <Link to="/settings">Open</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for{" "}
              <span className="font-medium text-foreground">
                {resetUser?.first_name} {resetUser?.last_name}
              </span>{" "}
              (@{resetUser?.username}). They will need to use this new password
              on their next login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {resetError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {resetError}
              </div>
            )}
            {resetSuccess && (
              <div className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                {resetSuccess}
              </div>
            )}
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetUser(null)}>
              Close
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting}>
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <KeyRound className="mr-1 h-4 w-4" /> Reset Password
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
