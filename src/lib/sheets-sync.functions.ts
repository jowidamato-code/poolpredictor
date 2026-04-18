import { createServerFn } from "@tanstack/react-start";

export const syncUserFromSheet = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string }) => input)
  .handler(async ({ data }) => {
    const { fetchSheetUsers } = await import("@/lib/sheets-sync.server");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const sheetUsers = await fetchSheetUsers();
    const sheetUser = sheetUsers.find(
      (u) => u.username.toLowerCase() === data.username.toLowerCase(),
    );

    if (!sheetUser) return { found: false };

    // Check if user exists
    const { data: existingUsers } =
      await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === sheetUser.username.toLowerCase(),
    );

    const desiredRole = sheetUser.accountType.toLowerCase().includes("admin")
      ? "admin"
      : "user";

    if (!existing) {
      const { data: newUser, error } =
        await supabaseAdmin.auth.admin.createUser({
          email: sheetUser.username,
          password: sheetUser.password,
          email_confirm: true,
          user_metadata: {
            username: sheetUser.username,
            first_name: sheetUser.name,
            last_name: sheetUser.surname,
          },
        });

      if (error) throw new Error(error.message);

      await supabaseAdmin.from("user_roles").insert({
        user_id: newUser.user.id,
        role: desiredRole as any,
      });
    } else {
      // Update password to match sheet (source of truth)
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: sheetUser.password,
      });

      // Sync role from sheet (source of truth): remove any role that no longer matches, add the desired role
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", existing.id)
        .neq("role", desiredRole as any);

      const { data: existingRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", existing.id);

      if (!existingRoles?.some((r) => r.role === desiredRole)) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: existing.id,
          role: desiredRole as any,
        });
      }
    }

    return { found: true };
  });
