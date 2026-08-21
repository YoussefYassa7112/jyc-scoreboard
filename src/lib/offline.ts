import type { StandingRow } from "@/lib/standings";
import {
  readAdminTeamsCache,
  readFieldNotes,
  writeAdminTeamsCache,
  writeFieldNotes,
} from "@/lib/field-notes";

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
  cabinId?: number | null;
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

/** Lets the board react when the schedule changes the camper's team. */
export const TEAM_CHANGED_EVENT = "camp-my-team-changed";

export function writeMyTeamSnapshot(snapshot: MyTeamSnapshot | null) {
  if (typeof window === "undefined") return;
  try {
    if (!snapshot) {
      window.localStorage.removeItem(TEAM_STORAGE_KEY);
    } else {
      window.localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(snapshot));
    }
  } catch {
    /* ignore */
  }
  // Defer so CampSchedule never updates Scoreboard during render.
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(TEAM_CHANGED_EVENT));
  });
}

/** Drop a saved "my team" if that team is no longer on the live roster. */
export function dropMissingMyTeam(standings: StandingRow[]) {
  const snap = readMyTeamSnapshot();
  if (!snap) return;
  if (standings.some((row) => row.id === snap.teamId)) return;
  writeMyTeamSnapshot(null);
}

/** Wipe every local trace of a deleted team on this device. */
export function forgetTeamEverywhere(teamId: number) {
  const snap = readMyTeamSnapshot();
  if (snap?.teamId === teamId) writeMyTeamSnapshot(null);

  const cache = readStandingsCache();
  if (cache) {
    writeStandingsCache({
      standings: cache.standings.filter((row) => row.id !== teamId),
      asOf: cache.asOf,
    });
  }

  writeFieldNotes(readFieldNotes().filter((note) => note.teamId !== teamId));
  writeAdminTeamsCache(
    readAdminTeamsCache().filter((team) => team.id !== teamId),
  );
}

export function isBrowserOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
