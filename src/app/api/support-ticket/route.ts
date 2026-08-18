import { NextResponse } from "next/server";
import { createSupportTicket } from "@/lib/support-tickets";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let body: { email?: unknown; details?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  try {
    await createSupportTicket({
      ticketType: "event_submission_error",
      email,
      details: details || "No details provided.",
    });
  } catch {
    return NextResponse.json({ error: "Failed to send request." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
