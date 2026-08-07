import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client. Server-only — never import this from client code.
// Bypasses RLS, so it is used only in trusted Route Handlers for the
// public submission (write-only insert) and admin-authenticated actions.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
