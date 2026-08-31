import type { ScheduleBlock, ScheduleGroup } from "@/data/schedule";

export type CabinInfo = {
  id: number;
  group: "red" | "green";
  label: string;
};

/**
 * From the 2026 camp schedule sheet. The sheet groups cabins by language —
 * English (cabins 1-4) and French (cabins 5-8) — which is exactly how `red`
 * and `green` are already split here, confirmed by the leader names lining up
 * in order. The internal values stay red/green because that is what the teams
 * table stores; the language is carried alongside for display, since campers
 * looking for their group will be looking for "English" or "French".
 */
export const campCabins: CabinInfo[] = [
  { id: 1, group: "red", label: "Mina N. + Christina F." },
  { id: 2, group: "red", label: "Valera G. + Youssef Y." },
  { id: 3, group: "red", label: "Karine A. + Mickel S." },
  { id: 4, group: "red", label: "Robert M. + Imy S." },
  { id: 5, group: "green", label: "Carol H. + Julie" },
  { id: 6, group: "green", label: "Mark T. + Yoanna S." },
  { id: 7, group: "green", label: "Jean N. + Carole Y." },
  { id: 8, group: "green", label: "Maria E. + Gab N." },
];

/** What the schedule sheet calls each track. */
export const groupLanguage: Record<"red" | "green", string> = {
  red: "English",
  green: "French",
};

export function cabinsForGroup(group: "red" | "green"): CabinInfo[] {
  return campCabins.filter((cabin) => cabin.group === group);
}

/**
 * Which teams are already in each cabin of a group.
 *
 * Cabins used to be one team each and this reported the single holder, so the
 * picker could grey out the rest. Several teams now share a cabin, so it
 * reports the whole list instead: still worth showing, no longer a reason to
 * block the choice.
 */
export function cabinChoicesForGroup(
  group: "red" | "green",
  teams: { id: number; name?: string; cabinId?: number | null }[],
  exceptTeamId?: number | null,
): { cabin: CabinInfo; teamsIn: string[] }[] {
  return cabinsForGroup(group).map((cabin) => ({
    cabin,
    teamsIn: teams
      .filter(
        (row) =>
          row.cabinId === cabin.id &&
          (exceptTeamId == null || row.id !== exceptTeamId),
      )
      .map((row) => row.name?.trim() || `Team ${row.id}`),
  }));
}

export function getCabin(id: number | null | undefined): CabinInfo | null {
  if (id == null) return null;
  return campCabins.find((cabin) => cabin.id === id) ?? null;
}

export function parseCabinId(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || !getCabin(n)) return Number.NaN;
  return n;
}

export function cabinFitsGroup(
  cabinId: number | null | undefined,
  group: ScheduleGroup | "overview" | null | undefined,
): boolean {
  const cabin = getCabin(cabinId);
  if (!cabin) return false;
  if (group === "red" || group === "green") return cabin.group === group;
  return true;
}

export function blockVisibleToCabin(
  block: ScheduleBlock,
  cabinId: number | null | undefined,
): boolean {
  if (cabinId == null) return true;
  const cabin = getCabin(cabinId);
  if (
    cabin &&
    (block.group === "red" || block.group === "green") &&
    block.group !== cabin.group
  ) {
    return false;
  }
  if (!block.cabinIds?.length) return true;
  return block.cabinIds.includes(cabinId);
}

export function detailsForCabin(
  block: ScheduleBlock,
  cabinId: number | null | undefined,
): string[] | undefined {
  if (!block.details?.length) return block.details;
  if (cabinId == null) return block.details;
  const mine = block.details.filter((line) => lineMentionsCabin(line, cabinId));
  return mine.length ? mine : block.details;
}

function lineMentionsCabin(line: string, cabinId: number): boolean {
  if (new RegExp(`Cabin\\s+${cabinId}\\b`, "i").test(line)) return true;
  const ranges = line.matchAll(/Cabins?\s+(\d+)\s*[–-]\s*(\d+)/gi);
  for (const match of ranges) {
    const from = Number(match[1]);
    const to = Number(match[2]);
    if (cabinId >= from && cabinId <= to) return true;
  }
  return false;
}
