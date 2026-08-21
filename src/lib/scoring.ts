import { campDays } from "@/data/schedule";

export const SCORING_ACTIVITIES_KEY = "camp-scoring-activities";

export type ScoringActivity = {
  id: string;
  title: string;
  minPoints: number;
  maxPoints: number;
  enabled: boolean;
};

export type AwardKind = "activity" | "extra";

export type AwardDraft = {
  teamId: number;
  delta: number;
  kind: AwardKind;
  title: string;
  minPoints?: number;
  maxPoints?: number;
  reason?: string;
};

const SKIP_DEFAULT =
  /^(arrival|registration|wake-up|wake-up \+ packing|prayer|morning prayer|breakfast|breakfast for all|lunch|snack|supper|gathering|compline|lights out|chill time|leaving|goodbye|holy liturgy)/i;

function slug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function suggestedScoringActivities(): ScoringActivity[] {
  const seen = new Set<string>();
  const out: ScoringActivity[] = [];
  for (const day of campDays) {
    for (const block of day.blocks) {
      const title = block.title.trim();
      const key = title.toLowerCase();
      if (!title || seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: slug(title) || block.id,
        title,
        minPoints: 0,
        maxPoints: 10,
        enabled: !SKIP_DEFAULT.test(title),
      });
    }
  }
  return out;
}

function clampRange(min: number, max: number) {
  const lo = Number.isFinite(min) ? Math.trunc(min) : 0;
  const hi = Number.isFinite(max) ? Math.trunc(max) : lo;
  const minPoints = Math.min(lo, hi);
  const maxPoints = Math.max(lo, hi);
  return { minPoints, maxPoints };
}

export function sanitizeActivity(
  input: Partial<ScoringActivity> & { title?: string },
): ScoringActivity | null {
  const title = (input.title ?? "").trim();
  if (!title) return null;
  const { minPoints, maxPoints } = clampRange(
    Number(input.minPoints),
    Number(input.maxPoints),
  );
  return {
    id: input.id?.trim() || slug(title) || `event-${Date.now()}`,
    title,
    minPoints,
    maxPoints,
    enabled: input.enabled !== false,
  };
}

export function clampScore(value: number, min: number, max: number) {
  const n = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(max, Math.max(min, n));
}

export function readScoringActivities(): ScoringActivity[] {
  if (typeof window === "undefined") return suggestedScoringActivities();
  try {
    const raw = window.localStorage.getItem(SCORING_ACTIVITIES_KEY);
    if (!raw) return suggestedScoringActivities();
    const parsed = JSON.parse(raw) as ScoringActivity[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return suggestedScoringActivities();
    }
    return parsed
      .map((row) => sanitizeActivity(row))
      .filter((row): row is ScoringActivity => row !== null);
  } catch {
    return suggestedScoringActivities();
  }
}

export function writeScoringActivities(activities: ScoringActivity[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SCORING_ACTIVITIES_KEY,
      JSON.stringify(activities),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function mergeScheduleActivities(
  current: ScoringActivity[],
): ScoringActivity[] {
  const suggested = suggestedScoringActivities();
  const byTitle = new Map(
    current.map((row) => [row.title.toLowerCase(), row] as const),
  );
  const merged = [...current];
  for (const row of suggested) {
    if (!byTitle.has(row.title.toLowerCase())) {
      merged.push(row);
    }
  }
  return merged;
}

export function formatActivityNote(
  title: string,
  minPoints: number,
  maxPoints: number,
) {
  return `Activity · ${title} (cap ${minPoints}–${maxPoints})`;
}

export function formatExtraNote(reason: string) {
  const trimmed = reason.trim();
  return trimmed ? `Extra · ${trimmed}` : "Extra";
}

export function formatAwardNote(draft: AwardDraft) {
  if (draft.kind === "extra") {
    return formatExtraNote(draft.reason ?? draft.title);
  }
  return formatActivityNote(
    draft.title,
    draft.minPoints ?? 0,
    draft.maxPoints ?? draft.delta,
  );
}

export type ParsedPointNote = {
  kind: AwardKind | "legacy";
  title: string;
  capLabel?: string;
};

export function parsePointNote(note: string | null | undefined): ParsedPointNote {
  if (!note?.trim()) {
    return { kind: "legacy", title: "No note" };
  }
  if (note.startsWith("Activity · ")) {
    const rest = note.slice("Activity · ".length);
    const cap = rest.match(/\(cap (-?\d+)–(-?\d+)\)$/);
    return {
      kind: "activity",
      title: cap ? rest.slice(0, cap.index).trim() : rest,
      capLabel: cap ? `${cap[1]}–${cap[2]}` : undefined,
    };
  }
  if (note === "Extra") {
    return { kind: "extra", title: "No reason given" };
  }
  if (note.startsWith("Extra · ")) {
    return { kind: "extra", title: note.slice("Extra · ".length) };
  }
  return { kind: "legacy", title: note };
}
