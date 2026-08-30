import withSerwistInit from "@serwist/next";
import { spawnSync } from "node:child_process";
import type { NextConfig } from "next";

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

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
  ],
});

const nextConfig: NextConfig = {};

export default withSerwist(nextConfig);
