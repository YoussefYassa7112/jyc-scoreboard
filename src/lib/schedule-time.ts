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

export function findCampDayForDate(date = new Date()): CampDay | null {
  const key = isoDateKey(date);
  return campDays.find((d) => d.dateISO === key) ?? null;
}

export function blocksForGroup(
  day: CampDay,
  group: ScheduleGroup | "overview",
): ScheduleBlock[] {
  if (group === "overview") return day.blocks;
  return day.blocks.filter((b) => b.group === "all" || b.group === group);
}

export type NextEventResult =
  | { kind: "next"; day: CampDay; block: ScheduleBlock }
  | { kind: "before"; day: CampDay; block: ScheduleBlock }
  | { kind: "after" }
  | { kind: "none" };

export function findNextEvent(
  group: "red" | "green" | "overview",
  now = new Date(),
): NextEventResult {
  const todayKey = isoDateKey(now);
  const firstDay = campDays[0];
  const lastDay = campDays[campDays.length - 1];
  if (!firstDay || !lastDay) return { kind: "none" };

  if (todayKey < firstDay.dateISO) {
    const blocks = blocksForGroup(firstDay, group);
    const firstTimed = blocks.find((b) => parseTimeRange(b.time));
    if (firstTimed) return { kind: "before", day: firstDay, block: firstTimed };
    return { kind: "before", day: firstDay, block: blocks[0] ?? firstDay.blocks[0] };
  }

  if (todayKey > lastDay.dateISO) {
    return { kind: "after" };
  }

  // Search today then later days
  const startIdx = campDays.findIndex((d) => d.dateISO >= todayKey);
  for (let i = Math.max(0, startIdx); i < campDays.length; i++) {
    const day = campDays[i];
    const blocks = blocksForGroup(day, group);
    const nowMin =
      day.dateISO === todayKey ? minutesSinceMidnight(now) : -1;

    for (const block of blocks) {
      const range = parseTimeRange(block.time);
      if (!range) continue;
      if (day.dateISO > todayKey || range.endMin > nowMin) {
        return { kind: "next", day, block };
      }
    }
  }

  return { kind: "after" };
}

export function blocksAtRoom(roomId: string): Array<{
  day: CampDay;
  block: ScheduleBlock;
}> {
  const out: Array<{ day: CampDay; block: ScheduleBlock }> = [];
  for (const day of campDays) {
    for (const block of day.blocks) {
      const hit = block.locationIds?.some((id) => {
        const loc = getLocation(id);
        return loc?.roomId === roomId || id === roomId;
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
