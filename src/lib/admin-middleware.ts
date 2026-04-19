import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server-only middleware that ensures the caller is an authenticated admin.
// Builds on requireSupabaseAuth (which validates the JWT) and then verifies
// the user has the 'admin' role in user_roles using the service-role client.
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (error) {
      throw new Response("Forbidden", { status: 403 });
    }
    if (!data) {
      throw new Response("Forbidden: admin role required", { status: 403 });
    }

    return next({ context });
  });
