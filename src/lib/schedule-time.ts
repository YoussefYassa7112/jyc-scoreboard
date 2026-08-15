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
  const todayKey = isoDateKey(now);
  const day = days.find((d) => d.dateISO === todayKey);
  if (!day) return [];

  const live: TimedEvent[] = [];
  for (const block of blocksForGroup(day, group)) {
    if (blockStatus(day, block, now) === "live") {
      live.push({ day, block });
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
  const todayKey = isoDateKey(now);
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  if (!firstDay || !lastDay) return { kind: "none" };

  if (todayKey < firstDay.dateISO) {
    const blocks = blocksForTrack(firstDay, group, exclusive);
    const firstTimed = blocks.find((b) => parseTimeRange(b.time));
    if (firstTimed) return { kind: "before", day: firstDay, block: firstTimed };
    return { kind: "before", day: firstDay, block: blocks[0] ?? firstDay.blocks[0] };
  }

  if (todayKey > lastDay.dateISO) {
    return { kind: "after" };
  }

  const startIdx = days.findIndex((d) => d.dateISO >= todayKey);
  for (let i = Math.max(0, startIdx); i < days.length; i++) {
    const day = days[i];
    const blocks = blocksForTrack(day, group, exclusive);
    const nowMin = day.dateISO === todayKey ? minutesSinceMidnight(now) : -1;

    for (const block of blocks) {
      const range = parseTimeRange(block.time);
      if (!range) continue;
      const edgeMin = edge === "start" ? range.startMin : range.endMin;
      if (day.dateISO > todayKey || edgeMin > nowMin) {
        return { kind: "next", day, block };
      }
    }
  }

  return { kind: "after" };
}

export function blocksAtRoom(
  roomId: string,
  floorId?: string,
): Array<{
  day: CampDay;
  block: ScheduleBlock;
}> {
  const out: Array<{ day: CampDay; block: ScheduleBlock }> = [];
  for (const day of campDays) {
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
  const range = parseTimeRange(block.time);
  if (!range) return null;
  const [y, m, d] = day.dateISO.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  start.setMinutes(range.startMin);
  const end = new Date(y, m - 1, d, 0, 0, 0, 0);
  end.setMinutes(range.endMin);
  return { start, end };
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
