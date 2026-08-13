import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend";

const ALERT_RECIPIENT = "ally@meaningfulmarketinghouse.com";

export type TicketType = "event_submission_error" | "admin_login_help";

const TICKET_LABELS: Record<TicketType, string> = {
  event_submission_error: "Event submission error",
  admin_login_help: "Admin sign-in help requested",
};

export async function createSupportTicket(params: {
  ticketType: TicketType;
  email: string;
  details: string;
}) {
  const supabase = createAdminClient();
  await supabase.from("support_tickets").insert({
    ticket_type: params.ticketType,
    email: params.email,
    details: params.details,
  });

  await sendEmail({
    to: ALERT_RECIPIENT,
    subject: TICKET_LABELS[params.ticketType],
    text: `${TICKET_LABELS[params.ticketType]}\n\nEmail: ${params.email}\nDetails: ${params.details}`,
  });
}
