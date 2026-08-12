"use client";

import { useEffect } from "react";

/**
 * A service worker left behind by a local production build keeps serving its
 * cached bundles on the same origin, so `next dev` edits appear to do nothing.
 * Only runs in development; production keeps its offline service worker.
 */
export function DevServiceWorkerReset() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void (async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) return;
      await Promise.all(registrations.map((r) => r.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      window.location.reload();
    })();
  }, []);

  return null;
}
