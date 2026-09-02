import withSerwistInit from "@serwist/next";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import type { NextConfig } from "next";

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

/**
 * Files under `public/` are not in the build manifest, so they were only ever
 * cached after someone had already loaded them online. A camper who installed
 * the app and never opened the Map tab before losing signal got broken images
 * exactly where the map is most useful. It is ~400KB for the lot, so precache
 * it rather than hope they browsed the right tab first.
 */
function publicEntries(dir: string, revision: string) {
  const folder = `public/${dir}`;
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((name) => !name.startsWith("."))
    .map((name) => ({ url: `/${dir}/${name}`, revision }));
}

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  cacheOnNavigation: true,
  reloadOnOnline: false,
  additionalPrecacheEntries: [
    { url: "/", revision },
    { url: "/~offline", revision },
    // Staff need the dashboard shell to open with no connection so the field
    // notes stay usable; without this the navigation fallback serves /~offline.
    { url: "/admin", revision },
    // Deliberately NOT precaching /admin/login. It is a server component that
    // redirects signed-in staff to /admin, and the service worker installs in a
    // signed-in browser with cookies attached — so precaching it stores the
    // /admin page under the /admin/login key. Offline that turns any bounce to
    // the login page into an endless /admin <-> /admin/login flicker. The gate
    // no longer navigates there without a connection, which is the real fix.
    ...publicEntries("map", revision),
    ...publicEntries("icons", revision),
  ],
});

const nextConfig: NextConfig = {
  // Surfaced in the dry-run panel. A phone keeps serving the previous bundle
  // from the service worker until it has loaded twice, so "is this actually the
  // new build?" needs an answer you can read off the screen.
  env: { NEXT_PUBLIC_BUILD_SHA: revision },
};

export default withSerwist(nextConfig);
