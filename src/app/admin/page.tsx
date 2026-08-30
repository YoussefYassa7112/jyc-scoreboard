"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import {
  clearAdminSignedIn,
  markAdminSignedIn,
  wasAdminSignedIn,
} from "@/lib/admin-session";

/**
 * Gated on the client rather than on the server.
 *
 * This was a server component calling `isAdminAuthenticated()` and redirecting.
 * That works online, but offline the request never reaches the server at all:
 * the service worker answers with the offline fallback, so staff were bounced
 * out of the dashboard and onto a login form that cannot submit without WiFi —
 * which also locked them out of the field notes, the one part built to work
 * with no connection.
 *
 * So: online we still ask the server who you are and bounce you if the answer
 * is no. Offline we trust the local marker from the last successful sign-in.
 * That marker grants no access of its own — every route behind this page still
 * checks the httpOnly cookie server-side, so a forged flag yields the shell and
 * a 401 from everything in it.
 */
export default function AdminPage() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "allowed" | "denied">(
    "checking",
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // No connection: the server cannot be asked, so go on what this device
      // last knew. Nothing sensitive is reachable without the cookie anyway.
      if (!navigator.onLine) {
        if (!cancelled) setState(wasAdminSignedIn() ? "allowed" : "denied");
        return;
      }
      try {
        // A camp access point with no uplink neither answers nor fails, and
        // this check sits in front of the whole dashboard. Six seconds, then
        // fall through to what this device already knows.
        const attempt = new AbortController();
        const deadline = window.setTimeout(() => attempt.abort(), 6000);
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: attempt.signal,
        }).finally(() => window.clearTimeout(deadline));
        const data = (await res.json()) as { authenticated?: boolean };
        if (cancelled) return;
        if (data.authenticated) {
          // Re-arm the offline marker on every confirmed visit. It was only
          // ever written at sign-in, so a device with a live cookie but no
          // marker — storage cleared, or signed in before this existed — would
          // be turned away the first time it opened the dashboard offline.
          markAdminSignedIn();
          setState("allowed");
        } else {
          // The cookie is gone or expired — drop the marker so a later offline
          // visit does not keep opening a dashboard this device cannot use.
          clearAdminSignedIn();
          setState("denied");
        }
      } catch {
        // Online-ish but the check failed (flaky camp WiFi). Fall back to what
        // we last knew rather than throwing staff out mid-session.
        if (!cancelled) setState(wasAdminSignedIn() ? "allowed" : "denied");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state === "denied") router.replace("/admin/login");
  }, [state, router]);

  if (state === "checking") {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <p className="panel rounded-3xl px-6 py-8 text-center font-bold text-muted-soft">
          Opening camp control…
        </p>
      </main>
    );
  }

  if (state === "denied") return null;

  return <AdminDashboard />;
}
