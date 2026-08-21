export const FIELD_NOTES_KEY = "camp-field-notes";
export const ADMIN_TEAMS_CACHE_KEY = "camp-admin-teams-cache";

export type FieldNote = {
  id: string;
  teamId: number;
  teamName: string;
  teamColor: string;
  delta: number;
  note: string;
  createdAt: string;
};

export type CachedAdminTeam = {
  id: number;
  name: string;
  color: string;
  score: number;
  eventCount: number;
  campGroup: "red" | "green" | null;
  cabinId?: number | null;
};

export function readFieldNotes(): FieldNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FIELD_NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FieldNote[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n) =>
        n &&
        typeof n.id === "string" &&
        typeof n.teamId === "number" &&
        typeof n.delta === "number",
    );
  } catch {
    return [];
  }
}

export function writeFieldNotes(notes: FieldNote[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FIELD_NOTES_KEY, JSON.stringify(notes));
  } catch {
    /* ignore quota / private mode */
  }
}

export function createFieldNote(input: Omit<FieldNote, "id" | "createdAt">): FieldNote {
  return {
    ...input,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
}

export function readAdminTeamsCache(): CachedAdminTeam[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ADMIN_TEAMS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CachedAdminTeam[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeAdminTeamsCache(teams: CachedAdminTeam[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADMIN_TEAMS_CACHE_KEY, JSON.stringify(teams));
  } catch {
    /* ignore */
  }
}
