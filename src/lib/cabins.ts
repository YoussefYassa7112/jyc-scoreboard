import type { ScheduleBlock, ScheduleGroup } from "@/data/schedule";

export type CabinInfo = {
  id: number;
  group: "red" | "green";
  /** The colour the sheet gives the cabin — what a camper will call it. */
  name: string;
  /** That colour as a value, so a bracelet can be matched to the screen. */
  swatch: string;
  /** The two leaders. */
  label: string;
};

/**
 * From the 2026 camp schedule sheet: cabin colour, leaders, and the language
 * split — English (cabins 1-4) and French (cabins 5-8), which is exactly how
 * `red` and `green` are already split here. The internal values stay red/green because that is what the teams
 * table stores; the language is carried alongside for display, since campers
 * looking for their group will be looking for "English" or "French".
 */
export const campCabins: CabinInfo[] = [
  { id: 1, group: "red", name: "Green", swatch: "#22c55e", label: "Mina N. + Carole Y." },
  { id: 2, group: "red", name: "Red", swatch: "#ef4444", label: "Valera G. + Youssef Y." },
  { id: 3, group: "red", name: "Light Blue", swatch: "#7dd3fc", label: "Karine A. + Mickel S." },
  { id: 4, group: "red", name: "Purple", swatch: "#a855f7", label: "Robert M. + Imy S." },
  { id: 5, group: "green", name: "Teal", swatch: "#14b8a6", label: "Carol H. + Julie" },
  { id: 6, group: "green", name: "Orange", swatch: "#f97316", label: "Mark T. + Yoanna S." },
  { id: 7, group: "green", name: "Yellow", swatch: "#facc15", label: "Jean N. + Christina F." },
  { id: 8, group: "green", name: "Navy Blue", swatch: "#1e3a8a", label: "Maria E. + Gab N." },
];

/**
 * One formatter for every place a cabin is named, so the admin picker, the
 * schedule lists and the "your cabin" line cannot drift apart.
 *
 * Note two of the cabin colours are Green and Red, which are also the internal
 * names of the two tracks. They are unrelated: cabin Green and cabin Red both
 * belong to the English side. The track is always shown as English or French
 * for exactly this reason.
 */
export function cabinLabel(cabin: CabinInfo) {
  return `Cabin ${cabin.id} · ${cabin.name} · ${cabin.label}`;
}

/** Compact form for parentheticals: "Green · Mina N. + Carole Y." */
export function cabinTag(cabin: CabinInfo) {
  return `${cabin.name} · ${cabin.label}`;
}

/** What the schedule sheet calls each track. */
export const groupLanguage: Record<"red" | "green", string> = {
  red: "English",
  green: "French",
};

/**
 * Readable text for a bracelet-coloured surface.
 *
 * The swatches run from Navy Blue to Yellow, so a single fixed foreground would
 * be unreadable on half of them. Relative luminance picks the side with the
 * contrast, the same way the map pins do.
 */
function luminance(hex: string) {
  const h = hex.replace("#", "");
  const channel = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  const linear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return (
    0.2126 * linear(channel(0)) +
    0.7152 * linear(channel(2)) +
    0.0722 * linear(channel(4))
  );
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const CAMP_INK = "#1a120c";
export const CAMP_PAPER = "#fff8ee";

/**
 * Readable text for a bracelet-coloured surface.
 *
 * The swatches run from Navy Blue to Yellow, so no single foreground works on
 * all of them. This measures both and takes whichever actually has the
 * contrast, rather than guessing from a lightness threshold — several of these
 * colours sit close enough to the middle that a threshold picks wrong.
 */
export function inkOn(hex: string) {
  return contrast(hex, CAMP_INK) >= contrast(hex, CAMP_PAPER)
    ? CAMP_INK
    : CAMP_PAPER;
}

/** A scrim in the opposite tone, so small print stays readable on any swatch. */
export function scrimOn(hex: string) {
  return inkOn(hex) === CAMP_INK
    ? "rgba(255,248,238,0.78)"
    : "rgba(26,18,12,0.45)";
}

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

/**
 * The camper's own slice of a rotation line.
 *
 * A line covers every cabin at once — "3:00 – 3:30 — Green: Obstacle Course ·
 * Red: Pulling Tire · Light Blue: BabyFoot · Purple: Kickball" — so matching it
 * to a cabin kept all four. This keeps the time and the one activity that is
 * theirs, and returns null when the line is not a rotation at all.
 */
export function detailLineForCabin(
  line: string,
  cabin: CabinInfo,
): string | null {
  // Longest first, so "Light Blue" is not shadowed by a shorter name. Built by
  // concatenation rather than escapes: every pattern here is plain text.
  const names = campCabins
    .map((c) => c.name)
    .sort((a, b) => b.length - a.length)
    .join("|");

  if (!new RegExp("(" + names + ") *:", "i").test(line)) return null;

  const parts = line.split("·");
  const lead = parts[0].match(
    new RegExp("^([^]*?)(?=(?:" + names + ") *:)", "i"),
  );
  const prefix = lead ? lead[1] : "";
  const mine = new RegExp(cabin.name + " *:(.*)$", "i");

  for (const part of parts) {
    const hit = part.match(mine);
    if (hit) return (prefix + hit[1]).replace(/\s+/g, " ").trim();
  }
  return null;
}

export function detailsForCabin(
  block: ScheduleBlock,
  cabinId: number | null | undefined,
): string[] | undefined {
  if (!block.details?.length) return block.details;
  if (cabinId == null) return block.details;
  const cabin = getCabin(cabinId);
  if (cabin) {
    // Rotation lines get sliced down to this cabin's own activity.
    const sliced = block.details
      .map((line) => detailLineForCabin(line, cabin))
      .filter((line): line is string => line !== null);
    if (sliced.length) return sliced;
  }
  const mine = block.details.filter((line) => lineMentionsCabin(line, cabinId));
  return mine.length ? mine : block.details;
}

function lineMentionsCabin(line: string, cabinId: number): boolean {
  // Rotation lines name the cabin by its colour — "Light Blue: BabyFoot" —
  // since that is what a camper is wearing. Cabin names are letters and
  // spaces only, so they go into the pattern as they are.
  const cabin = getCabin(cabinId);
  if (cabin) {
    const byColour = new RegExp(String.raw`\b` + cabin.name + String.raw`\s*:`, "i");
    if (byColour.test(line)) return true;
  }
  if (new RegExp(`Cabin\\s+${cabinId}\\b`, "i").test(line)) return true;
  const ranges = line.matchAll(/Cabins?\s+(\d+)\s*[–-]\s*(\d+)/gi);
  for (const match of ranges) {
    const from = Number(match[1]);
    const to = Number(match[2]);
    if (cabinId >= from && cabinId <= to) return true;
  }
  return false;
}
