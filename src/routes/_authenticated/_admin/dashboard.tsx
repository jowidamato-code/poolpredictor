import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createServerFn } from "@tanstack/react-start";
import { adminResetPasswordFn } from "@/lib/admin-users.functions";
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
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/dashboard")({
  component: AdminDashboard,
});

const createUserFn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string; firstName: string; lastName: string; username: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username: data.username,
        first_name: data.firstName,
        last_name: data.lastName,
      },
    });
    if (error) throw new Error(error.message);
    return { userId: user.user.id };
  });

const assignRoleFn = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; role: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").insert({
      user_id: data.userId,
      role: data.role as any,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

const deleteUserFn = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
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
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    username: "",
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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [profilesRes, matchesRes, teamsRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("matches").select("*").order("match_number"),
      supabase.from("teams").select("*").order("name"),
    ]);
    setUsers(profilesRes.data ?? []);
    setMatches(matchesRes.data ?? []);
    setTeams(teamsRes.data ?? []);

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
      const result = await createUserFn({ data: newUser });
      await assignRoleFn({ data: { userId: result.userId, role: "user" } });
      setAddSuccess(`User ${newUser.email} created successfully!`);
      setNewUser({ email: "", password: "", firstName: "", lastName: "", username: "" });
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
      await deleteUserFn({ data: { userId } });
      await loadData();
    } catch (err: any) {
      alert("Failed to delete user: " + err.message);
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
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="results">Match Results</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{users.length} registered users</p>
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
                  <Input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                </div>
                <Button onClick={handleAddUser} disabled={addingUser}>
                  {addingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Create User
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {users.map((user) => (
              <Card key={user.user_id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.user_id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
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
                <CardContent className="flex items-center gap-4 p-4">
                  <Badge variant="outline" className="text-xs">{match.round}</Badge>
                  <span className="text-sm font-medium text-foreground flex-1 text-right">
                    {teamA?.name ?? "TBD"}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 w-14 text-center"
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
                    className="h-9 w-14 text-center"
                    value={result?.score_b ?? ""}
                    onChange={(e) =>
                      setMatchResults((prev) => ({
                        ...prev,
                        [match.id]: { ...prev[match.id], score_b: e.target.value },
                      }))
                    }
                  />
                  <span className="text-sm font-medium text-foreground flex-1">
                    {teamB?.name ?? "TBD"}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleUpdateMatchResult(match.id)}
                    disabled={updatingMatch === match.id}
                  >
                    {updatingMatch === match.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  {match.played && <Badge className="bg-primary/20 text-primary">Done</Badge>}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
