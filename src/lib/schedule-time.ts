import { getLocation } from "@/data/locations";
import {
  campDays,
  type CampDay,
  type ScheduleBlock,
  type ScheduleGroup,
} from "@/data/schedule";

/** Parse "8:00 AM", "12:30 PM", "1:00" style tokens into minutes from midnight */
export function parseClockToMinutes(raw: string): number | null {
  const cleaned = raw
    .replace(/\u2013|\u2014/g, "-")
    .trim()
    .toUpperCase();
  if (!cleaned || cleaned === "TBD") return null;

  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) {
    return null;
  }
  if (hour < 1 || hour > 12) return null;

  if (meridiem === "PM" && hour < 12) hour += 12;
  else if (meridiem === "AM" && hour === 12) hour = 0;
  else if (!meridiem) {
    // Camp sheet often omits AM/PM: 1–7 => afternoon, 8–11 => morning, 12 => noon
    if (hour >= 1 && hour <= 7) hour += 12;
  }

  return hour * 60 + minute;
}

export type ParsedTimeRange = {
  startMin: number;
  endMin: number;
};

/** Parse "10:00 – 12:00", "8:00 AM", "11:00 PM" into a range */
export function parseTimeRange(time: string | undefined): ParsedTimeRange | null {
  if (!time || time.trim().toUpperCase() === "TBD") return null;
  const normalized = time.replace(/\u2013|\u2014/g, "-");
  const parts = normalized.split(/\s*-\s*/).map((p) => p.trim());

  if (parts.length === 1) {
    const startMin = parseClockToMinutes(parts[0]);
    if (startMin == null) return null;
    return { startMin, endMin: startMin };
  }

  // Inherit AM/PM from the end token when start omits it ("10:00 - 12:00 PM" rare; usually both plain or both with meridiem)
  let startRaw = parts[0];
  const endRaw = parts[1];
  const endMeridiem = endRaw.match(/\b(AM|PM)\b/i)?.[1];
  const startHasMeridiem = /\b(AM|PM)\b/i.test(startRaw);
  if (endMeridiem && !startHasMeridiem) {
    startRaw = `${startRaw} ${endMeridiem}`;
  }

  const startMin = parseClockToMinutes(startRaw);
  const endMin = parseClockToMinutes(endRaw);
  if (startMin == null || endMin == null) return null;

  // Lights out spanning midnight e.g. end before start
  if (endMin < startMin) {
    return { startMin, endMin: endMin + 24 * 60 };
  }
  return { startMin, endMin };
}

export function dayDate(day: CampDay, at = new Date()): Date {
  const [y, m, d] = day.dateISO.split("-").map(Number);
  return new Date(at.getFullYear() === y ? y : y, m - 1, d);
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function isoDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function findCampDayForDate(
  date = new Date(),
  days: CampDay[] = campDays,
): CampDay | null {
  const key = isoDateKey(date);
  return days.find((d) => d.dateISO === key) ?? null;
}

/** overview = every block; all = shared only; red/green = that track + shared */
export type ScheduleTrack = ScheduleGroup | "overview";

export function blocksForGroup(
  day: CampDay,
  group: ScheduleTrack,
): ScheduleBlock[] {
  if (group === "overview") return day.blocks;
  return day.blocks.filter((b) => b.group === "all" || b.group === group);
}

export type TimedEvent = {
  day: CampDay;
  block: ScheduleBlock;
};

export type NextEventResult =
  | { kind: "next"; day: CampDay; block: ScheduleBlock }
  | { kind: "before"; day: CampDay; block: ScheduleBlock }
  | { kind: "after" }
  | { kind: "none" };

export type BlockStatus = "upcoming" | "live" | "done" | "untimed";

export function blockStatus(
  day: CampDay,
  block: ScheduleBlock,
  now = new Date(),
): BlockStatus {
  const times = eventDateTimes(day, block);
  if (!times) return "untimed";
  const t = now.getTime();
  if (t >= times.end.getTime()) return "done";
  if (t >= times.start.getTime()) return "live";
  return "upcoming";
}

/** Timed blocks on this track are all finished. TBD / untimed items don't block. */
export function dayIsComplete(
  day: CampDay,
  now = new Date(),
  group: ScheduleTrack = "overview",
): boolean {
  let timed = 0;
  for (const block of blocksForGroup(day, group)) {
    const status = blockStatus(day, block, now);
    if (status === "untimed") continue;
    timed += 1;
    if (status !== "done") return false;
  }
  return timed > 0;
}

/** First day that still has a live or upcoming timed event. Last day if camp is over. */
export function firstOpenDay(
  days: CampDay[],
  now = new Date(),
  group: ScheduleTrack = "overview",
): CampDay | null {
  if (days.length === 0) return null;
  for (const day of days) {
    if (!dayIsComplete(day, now, group)) return day;
  }
  return days[days.length - 1] ?? null;
}

export function findNextEvent(
  group: ScheduleTrack,
  now = new Date(),
  days: CampDay[] = campDays,
): NextEventResult {
  return findTimedEvent(group, now, days, "end");
}

/** Next block that has not started yet — used for 15-minute reminders. */
export function findUpcomingEvent(
  group: ScheduleTrack,
  now = new Date(),
  days: CampDay[] = campDays,
): NextEventResult {
  return findTimedEvent(group, now, days, "start");
}

/** Next block on this color only — skips shared Everyone events. */
export function findUpcomingExclusive(
  group: ScheduleGroup,
  now = new Date(),
  days: CampDay[] = campDays,
): NextEventResult {
  return findTimedEvent(group, now, days, "start", true);
}

/** Every block currently in progress for this track (can be more than one). */
export function findLiveEvents(
  group: ScheduleTrack,
  now = new Date(),
  days: CampDay[] = campDays,
): TimedEvent[] {
  const live: TimedEvent[] = [];
  for (const day of days) {
    for (const block of blocksForGroup(day, group)) {
      if (blockStatus(day, block, now) === "live") {
        live.push({ day, block });
      }
    }
  }
  return live;
}

export function eventCountdown(
  day: CampDay,
  block: ScheduleBlock,
  now = new Date(),
): { startsIn: number; endsIn: number; status: BlockStatus } | null {
  const times = eventDateTimes(day, block);
  if (!times) return null;
  const t = now.getTime();
  return {
    startsIn: times.start.getTime() - t,
    endsIn: times.end.getTime() - t,
    status: blockStatus(day, block, now),
  };
}

function blocksForTrack(
  day: CampDay,
  group: ScheduleTrack,
  exclusive: boolean,
): ScheduleBlock[] {
  if (exclusive && group !== "overview") {
    return day.blocks.filter((b) => b.group === group);
  }
  return blocksForGroup(day, group);
}

function findTimedEvent(
  group: ScheduleTrack,
  now: Date,
  days: CampDay[],
  edge: "start" | "end",
  exclusive = false,
): NextEventResult {
  const nowMs = now.getTime();
  const timed: Array<{
    day: CampDay;
    block: ScheduleBlock;
    start: number;
    end: number;
  }> = [];

  for (const day of days) {
    for (const block of blocksForTrack(day, group, exclusive)) {
      const times = eventDateTimes(day, block);
      if (!times) continue;
      timed.push({
        day,
        block,
        start: times.start.getTime(),
        end: times.end.getTime(),
      });
    }
  }
  timed.sort((a, b) => a.start - b.start || a.end - b.end);
  if (timed.length === 0) return { kind: "none" };

  const first = timed[0]!;
  if (nowMs < first.start) {
    return { kind: "before", day: first.day, block: first.block };
  }

  const next = timed.find((item) =>
    edge === "start" ? item.start > nowMs : item.end > nowMs,
  );
  if (!next) return { kind: "after" };
  return { kind: "next", day: next.day, block: next.block };
}

export function blocksAtRoom(
  roomId: string,
  floorId?: string,
  days: CampDay[] = campDays,
): Array<{
  day: CampDay;
  block: ScheduleBlock;
}> {
  const out: Array<{ day: CampDay; block: ScheduleBlock }> = [];
  for (const day of days) {
    for (const block of day.blocks) {
      const hit = block.locationIds?.some((id) => {
        const loc = getLocation(id);
        if (loc?.roomId !== roomId) return false;
        if (floorId && loc.floorId && loc.floorId !== floorId) return false;
        return true;
      });
      if (hit) out.push({ day, block });
    }
  }
  return out;
}

/** Absolute start/end Date for a block on its camp day */
export function eventDateTimes(
  day: CampDay,
  block: ScheduleBlock,
): { start: Date; end: Date } | null {
  if (block.startMs != null && block.endMs != null) {
    return { start: new Date(block.startMs), end: new Date(block.endMs) };
  }
  const range = parseTimeRange(block.time);
  if (!range) return null;
  let startMin = range.startMin;
  let endMin = range.endMin;

  // Without an AM/PM marker the clock parser can only guess, and it guesses PM
  // for 1-7 only — so a bare "9:00 - 9:30" on an evening block silently became
  // 9am, which put Compline and the campfire in the middle of the morning and
  // made "Happening now" and "Coming up next" wrong for the whole of day 1.
  // The times now spell out AM/PM, and this catches any that stop doing so.
  const spellsOutMeridiem = /(AM|PM)/i.test(block.time ?? "");
  if (block.section === "evening" && !spellsOutMeridiem && startMin < 12 * 60) {
    startMin += 12 * 60;
    endMin += 12 * 60;
  }

  // "12:00 AM" on an evening block is midnight at the *end* of that camp day,
  // not 00:00 at the start (which would land 10 hours before Arrival).
  if (block.section === "evening" && startMin < 4 * 60) {
    startMin += 24 * 60;
    endMin += 24 * 60;
  }
  const [y, m, d] = day.dateISO.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  start.setMinutes(startMin);
  const end = new Date(y, m - 1, d, 0, 0, 0, 0);
  end.setMinutes(endMin);
  return { start, end };
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}
