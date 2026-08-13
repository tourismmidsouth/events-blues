"use client";

import { useState } from "react";

export default function AuthErrorHelp({ authError }: { authError: string }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      await fetch("/api/admin-login-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, details: `Sign-in link failed: ${authError}` }),
      });
    } finally {
      setSending(false);
      setSent(true);
    }
  }

  if (sent) {
    return <p>Thanks — we&apos;ll be in touch within 1 business day.</p>;
  }

  return (
    <div className="field">
      <label htmlFor="auth_error_email">
        Still can&apos;t sign in? Enter your email and we&apos;ll help resolve
        this within 1 business day.
      </label>
      <input
        id="auth_error_email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div>
        <button type="button" onClick={handleSend} disabled={sending || !email}>
          {sending ? "Sending…" : "Send Support Request"}
        </button>
      </div>
    </div>
  );
}
