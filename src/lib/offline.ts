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
  /**
   * null when the camper picked a bracelet rather than a team. The schedule
   * only needs the cabin and its track; the team was a step in the way.
   */
  teamId: number | null;
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
    // A cabin is a valid choice on its own; a team id is not required, and
    // demanding one here threw away every bracelet-only snapshot on reload.
    const hasTeam = typeof parsed.teamId === "number";
    const hasCabin = typeof parsed.cabinId === "number";
    if (!hasTeam && !hasCabin) return null;
    if (!hasTeam) parsed.teamId = null;
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
  // An empty roster is not evidence that a team was deleted — it is what a
  // cold start, a failed fetch or an empty response looks like. Treating it as
  // proof wiped the camper's saved team on the spot, which is why picking a
  // team never seemed to stick.
  if (standings.length === 0) return;
  const snap = readMyTeamSnapshot();
  if (!snap) return;
  // A bracelet-only choice has no team to go missing.
  if (snap.teamId == null) return;
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
