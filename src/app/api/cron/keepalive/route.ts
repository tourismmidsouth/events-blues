import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Supabase's free tier auto-pauses a project after 7 days with no database
// activity. This route runs on a schedule well inside that window (see
// vercel.json) and does the cheapest possible real query — a HEAD count on
// events — purely to register activity and keep the project awake.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("events").select("id", { count: "exact", head: true }).limit(1);

  if (error) {
    return NextResponse.json({ error: "Keepalive query failed." }, { status: 500 });
  }

  return NextResponse.json({ success: true, ranAt: new Date().toISOString() });
}
