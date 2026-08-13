import { NextResponse } from "next/server";

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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email service not configured." }, { status: 500 });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Blues Backroads Events <admin@mail.bluesbackroads.com>",
      to: HELP_RECIPIENT,
      subject: "Admin sign-in help requested",
      text: `An admin couldn't get their sign-in link and needs manual help.\n\nEmail: ${email}`,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to send request." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
