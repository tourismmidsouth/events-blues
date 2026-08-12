"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (signInError) {
      setError("Unable to send sign-in link. Please try again.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <p>
        Check <strong>{email}</strong> for a sign-in link. You can close this
        tab after clicking it.
      </p>
    );
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      {error && <p className="error-text">{error}</p>}
      <div>
        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Sending link…" : "Send Magic Link"}
        </button>
      </div>
    </form>
  );
}
