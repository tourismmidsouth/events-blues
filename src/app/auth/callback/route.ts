import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/admin/events`);
    }

    console.error("auth callback exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(
      `${origin}/admin/login?auth_error=${encodeURIComponent(error.message)}`
    );
  }

  const errorDescription = searchParams.get("error_description");
  return NextResponse.redirect(
    `${origin}/admin/login${errorDescription ? `?auth_error=${encodeURIComponent(errorDescription)}` : ""}`
  );
}
