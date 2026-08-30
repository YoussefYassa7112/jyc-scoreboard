import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Everything under /api/ is cached network-first by the default rules, and
    // for standings that is a feature. For auth it is a trap: a stale
    // "authenticated: false" served from cache makes the dashboard gate wipe
    // this device's sign-in marker, locking staff out of the offline features
    // for the rest of camp. Whether someone is signed in is never answerable
    // from cache, so never answer it from there.
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && url.pathname.startsWith("/api/auth/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
