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

      const role = sheetUser.accountType.toLowerCase().includes("admin")
        ? "admin"
        : "user";
      await supabaseAdmin.from("user_roles").insert({
        user_id: newUser.user.id,
        role: role as any,
      });
    } else {
      // Update password to match sheet (source of truth)
      await supabaseAdmin.auth.admin.updateUser(existing.id, {
        password: sheetUser.password,
      });
    }

    return { found: true };
  });
