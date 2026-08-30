"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { fadeSoft, springSoft } from "@/lib/motion";
import { markAdminSignedIn } from "@/lib/admin-session";
import { useOnline } from "@/lib/use-online";
import { ControlDock } from "./ControlDock";
import { OfflineBanner } from "./OfflineBanner";
import { SkyDecor } from "./SkyDecor";
import { BusyLabel } from "./Spinner";

export function AdminLoginForm() {
  const router = useRouter();
  const online = useOnline();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!online) {
      setError("Needs WiFi — connect to sign in.");
      return;
    }
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
      // Remember on this device that staff signed in, so the dashboard shell
      // still opens when there is no WiFi to ask the server.
      markAdminSignedIn();
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col px-4 py-6">
      <SkyDecor />
      <div className="relative z-10 mx-auto w-full max-w-md">
        <ControlDock />
      </div>
      <div className="relative z-10 flex flex-1 items-center justify-center py-6">
      <motion.form
        layout
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={springSoft}
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

        <div className="mt-4">
          <OfflineBanner
            online={online}
            detail="Needs WiFi to sign in. Campers can still use Map & Schedule after the app is cached."
          />
        </div>

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
            disabled={!online}
            className="field w-full rounded-xl border-2 px-4 py-3 text-base font-semibold outline-none ring-star/40 focus:ring-4 disabled:opacity-60"
          />
        </label>

        <AnimatePresence initial={false}>
          {error ? (
            <motion.p
              key="login-error"
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              transition={fadeSoft}
              className="mt-3 overflow-hidden text-sm font-bold text-star"
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <button
          type="submit"
          disabled={loading || !online}
          className="btn-cta mt-5 w-full rounded-xl bg-star px-4 py-3 text-base font-extrabold transition hover:brightness-110 disabled:opacity-60"
        >
          <BusyLabel busy={loading} busyLabel="Signing in…">
            {online ? "Enter admin" : "Needs WiFi"}
          </BusyLabel>
        </button>

        <Link
          href="/"
          className="mt-4 block text-center text-sm font-bold text-star underline-offset-2 hover:underline"
        >
          Back to scoreboard
        </Link>
      </motion.form>
      </div>
    </main>
  );
}
