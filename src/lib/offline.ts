import type { StandingRow } from "@/lib/standings";

export const STANDINGS_CACHE_KEY = "camp-standings-cache";
export const TEAM_STORAGE_KEY = "camp-my-team";

export type StandingsCache = {
  standings: StandingRow[];
  asOf: string;
  savedAt: string;
};

export type MyTeamSnapshot = {
  teamId: number;
  campGroup?: "red" | "green" | null;
  teamName?: string;
};

export function readStandingsCache(): StandingsCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STANDINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StandingsCache;
    if (!Array.isArray(parsed.standings) || typeof parsed.asOf !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStandingsCache(data: {
  standings: StandingRow[];
  asOf: string;
}) {
  if (typeof window === "undefined") return;
  try {
    const payload: StandingsCache = {
      ...data,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STANDINGS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readMyTeamSnapshot(): MyTeamSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TEAM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MyTeamSnapshot;
    if (typeof parsed.teamId !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMyTeamSnapshot(snapshot: MyTeamSnapshot | null) {
  if (typeof window === "undefined") return;
  try {
    if (!snapshot) {
      window.localStorage.removeItem(TEAM_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function isBrowserOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
