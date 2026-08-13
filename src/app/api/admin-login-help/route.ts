import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";

const HELP_RECIPIENT = "ally@meaningfulmarketing.com";

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
    await sendEmail({
      to: HELP_RECIPIENT,
      subject: "Admin sign-in help requested",
      text: `An admin couldn't get their sign-in link and needs manual help.\n\nEmail: ${email}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to send request." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
