import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend";

export async function POST(request: Request) {
  let body: { eventId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("title, submitter_email, approval_email_sent_at")
    .eq("id", eventId)
    .maybeSingle();

  if (fetchError || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  if (event.approval_email_sent_at) {
    return NextResponse.json({ success: false, alreadySent: true });
  }

  // Atomically claim the "send" by setting the timestamp only if it's still
  // null. If another request already claimed it (e.g. a double click, or
  // two admins approving at once), no row comes back and we skip sending —
  // this is what guarantees the email only ever goes out once per event.
  const { data: claimed, error: claimError } = await supabase
    .from("events")
    .update({ approval_email_sent_at: new Date().toISOString() })
    .eq("id", eventId)
    .is("approval_email_sent_at", null)
    .select("id")
    .maybeSingle();

  if (claimError) {
    return NextResponse.json({ error: "Failed to record notification." }, { status: 500 });
  }
  if (!claimed) {
    return NextResponse.json({ success: false, alreadySent: true });
  }

  try {
    await sendEmail({
      to: event.submitter_email,
      subject: "Your event is live on Blues Backroads!",
      text: `Hi there,

Thank you so much for submitting "${event.title}" to Blues Backroads Events! We're happy to let you know it's been approved and is now live at https://bluesbackroads.com/.

If you have any questions, feel free to reach out to us at tourism@midsouthdd.org (please don't reply directly to this email).

Thanks again for sharing your event with the Blues Backroads community!`,
    });
  } catch {
    // Release the claim so the email can be retried later.
    await supabase.from("events").update({ approval_email_sent_at: null }).eq("id", eventId);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
