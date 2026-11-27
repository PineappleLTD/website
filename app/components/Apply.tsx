"use client";

import { useState, type FormEvent } from "react";

// Posts to the Worker in worker/index.ts, which keeps one application per
// email in D1. It only exists on the Cloudflare deploy (pineapplehacks.com).
type Status = "idle" | "sending" | "done";

export default function Apply() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setStatus("done");
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "That didn't go through. Please try again later.");
    } catch {
      setError("That didn't go through. Please try again later.");
    }
    setStatus("idle");
  };

  if (status === "done") {
    return (
      <p role="status" className="text-sm text-white/70">
        Thanks! We&apos;ll email you when applications open.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          placeholder="you@example.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1 border-b border-white/20 bg-transparent py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-white/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending" || !email.trim()}
          className="shrink-0 px-1 text-sm text-white/70 transition-colors hover:text-white disabled:text-white/30"
        >
          {status === "sending" ? "Sending…" : "Submit"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-300/80">
          {error}
        </p>
      )}
    </form>
  );
}
