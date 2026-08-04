"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SkyDecor } from "./SkyDecor";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Login failed");
      }
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <SkyDecor />
      <form
        onSubmit={onSubmit}
        className="panel relative z-10 w-full max-w-md rounded-3xl p-6 sm:p-8"
      >
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-saddle/70">
          Staff only
        </p>
        <h1 className="display-font mt-2 text-3xl font-bold text-ink sm:text-4xl">
          Admin login
        </h1>
        <p className="mt-2 text-sm font-semibold text-saddle/80">
          Enter the camp password to manage teams and points.
        </p>

        <label className="mt-6 block">
          <span className="mb-1.5 block text-sm font-bold text-saddle">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-xl border-2 border-saddle/20 bg-white/80 px-4 py-3 text-base font-semibold outline-none ring-woody/40 focus:ring-4"
          />
        </label>

        {error ? (
          <p className="mt-3 text-sm font-bold text-woody">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-woody px-4 py-3 text-base font-extrabold text-cloud transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Enter admin"}
        </button>

        <Link
          href="/"
          className="mt-4 block text-center text-sm font-bold text-buzz underline-offset-2 hover:underline"
        >
          Back to scoreboard
        </Link>
      </form>
    </main>
  );
}
