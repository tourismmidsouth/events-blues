import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend";

const ALERT_RECIPIENT = "ally@meaningfulmarketinghouse.com";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("events").select("id", { count: "exact", head: true });

  if (error) {
    try {
      await sendEmail({
        to: ALERT_RECIPIENT,
        subject: "ALERT: Blues Backroads Events — Supabase health check failed",
        text: `The scheduled Supabase health check failed at ${new Date().toISOString()}.\n\nError: ${error.message}\n\nThis could mean the Supabase project is paused, misconfigured, or unreachable. Check the Supabase dashboard for the events-blues project.`,
      });
    } catch (emailError) {
      return NextResponse.json(
        { error: "Supabase check failed and alert email also failed to send.", supabaseError: error.message, emailError: String(emailError) },
        { status: 500 }
      );
    }
    return NextResponse.json({ healthy: false, error: error.message }, { status: 200 });
  }

  return NextResponse.json({ healthy: true });
}
