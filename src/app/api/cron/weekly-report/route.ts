import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend";

const REPORT_RECIPIENT = "ally@meaningfulmarketinghouse.com";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: submittedCount },
    { count: publishedCount },
    { count: rejectedCount },
    { count: loginHelpCount },
    { count: submissionErrorCount },
  ] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).gte("submitted_at", since),
    supabase.from("events").select("id", { count: "exact", head: true }).gte("published_at", since),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "rejected")
      .gte("updated_at", since),
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("ticket_type", "admin_login_help")
      .gte("created_at", since),
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("ticket_type", "event_submission_error")
      .gte("created_at", since),
  ]);

  const emailConfigured = Boolean(process.env.RESEND_API_KEY);

  const summary = `Weekly Blues Backroads Events Report

System status: ${emailConfigured ? "Email sending appears configured (RESEND_API_KEY is set)." : "WARNING: RESEND_API_KEY is not set — emails will fail to send."}

Last 7 days:
- New event submissions: ${submittedCount ?? 0}
- Events approved/published: ${publishedCount ?? 0}
- Events rejected: ${rejectedCount ?? 0}
- Admin sign-in help requests: ${loginHelpCount ?? 0}
- Event submission error reports: ${submissionErrorCount ?? 0}

${(loginHelpCount ?? 0) > 0 || (submissionErrorCount ?? 0) > 0 ? "There were support tickets this week — check Supabase's support_tickets table for details." : "No support tickets this week."}`;

  try {
    await sendEmail({
      to: REPORT_RECIPIENT,
      subject: "Blues Backroads Events — Weekly Report",
      text: summary,
    });
  } catch {
    return NextResponse.json({ error: "Failed to send report." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
