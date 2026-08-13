"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [helpRequested, setHelpRequested] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    router.push("/admin/events");
    router.refresh();
  }

  async function handleMagicLinkSubmit(event: React.FormEvent) {
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

  function switchMode(nextMode: "password" | "magic-link") {
    setMode(nextMode);
    setError(null);
    setSent(false);
    setHelpRequested(false);
  }

  async function handleHelpRequest() {
    setHelpLoading(true);
    try {
      await fetch("/api/admin-login-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setHelpLoading(false);
      setHelpRequested(true);
    }
  }

  if (sent) {
    if (helpRequested) {
      return <p>Thanks — we&apos;ll be in touch within 1 business day.</p>;
    }

    return (
      <div className="form-grid">
        <p>
          Check <strong>{email}</strong> for a sign-in link. You can close
          this tab after clicking it. Be sure to check your junk or spam
          folder.
        </p>
        <p>
          Still nothing?{" "}
          <button
            type="button"
            className="link"
            onClick={handleHelpRequest}
            disabled={helpLoading}
            style={{ display: "inline" }}
          >
            {helpLoading ? "Sending…" : "Click here"}
          </button>
        </p>
      </div>
    );
  }

  if (mode === "magic-link") {
    return (
      <form className="form-grid" onSubmit={handleMagicLinkSubmit}>
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
        <button type="button" className="link" onClick={() => switchMode("password")}>
          Back to password sign-in
        </button>
      </form>
    );
  }

  return (
    <form className="form-grid" onSubmit={handlePasswordSubmit}>
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
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      {error && <p className="error-text">{error}</p>}
      <div>
        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </div>
      <button type="button" className="link" onClick={() => switchMode("magic-link")}>
        Forgot your password? Use a magic link instead
      </button>
    </form>
  );
}
