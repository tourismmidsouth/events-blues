import { NextResponse } from "next/server";
import { createSupportTicket } from "@/lib/support-tickets";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  try {
    await createSupportTicket({
      ticketType: "admin_login_help",
      email,
      details: "Admin couldn't get their magic-link sign-in email.",
    });
  } catch {
    return NextResponse.json({ error: "Failed to send request." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
