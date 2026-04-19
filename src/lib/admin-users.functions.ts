import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/lib/admin-middleware";

export const adminResetPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { userId: string; newPassword: string }) => {
    if (!input.userId || typeof input.userId !== "string") {
      throw new Error("Invalid user id");
    }
    if (!input.newPassword || input.newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    if (input.newPassword.length > 200) {
      throw new Error("Password too long");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      { password: data.newPassword },
    );
    if (error) throw new Error(error.message);
    return { success: true };
  });
