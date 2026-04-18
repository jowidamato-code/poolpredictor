import { createServerFn } from "@tanstack/react-start";

export const adminResetPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; newPassword: string }) => {
    if (!input.newPassword || input.newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
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
