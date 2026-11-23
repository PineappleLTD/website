"use client";

import { useState, type FormEvent } from "react";

// Google Form that collects signups. Both values come from the form's
// "Get pre-filled link" URL:
//   https://docs.google.com/forms/d/e/<FORM_ID>/viewform?usp=pp_url&<EMAIL_FIELD>=...
const FORM_ID = "1FAIpQLSf8CimbDS-GC71sYFRWSgYoCW9ubTRLT27m5h7-kfTbZB5-SQ";
const EMAIL_FIELD = "entry.611188102";

type Status = "idle" | "sending" | "done" | "error";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!FORM_ID || !EMAIL_FIELD) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      // Google Forms doesn't send CORS headers, so the response is opaque.
      // A network failure still throws, which is the case worth reporting.
      await fetch(`https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`, {
        method: "POST",
        mode: "no-cors",
        body: new URLSearchParams({ [EMAIL_FIELD]: email.trim() }),
      });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <p className="text-sm text-white/70">You&apos;re on the waitlist!</p>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1 border-b border-white/20 bg-transparent py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-white/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="shrink-0 px-1 text-sm text-white/70 transition-colors hover:text-white disabled:text-white/30"
        >
          {status === "sending" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-sm text-red-300/80">
          That didn&apos;t go through. Please try again later.
        </p>
      )}
    </form>
  );
}
