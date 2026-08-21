import { campDays, type CampDay, type ScheduleBlock } from "@/data/schedule";
import { eventDateTimes, isoDateKey } from "@/lib/schedule-time";

/**
 * Preview-branch only. Do not merge to main — production must keep Sept dates.
 * Shifts the real 3-day camp so Arrival starts at the stored origin (now).
 * Origin lives in localStorage so closing the phone overnight keeps the clock.
 */
export const LIVE_CAMP_SIM = false;

const ORIGIN_KEY = "camp-live-sim-origin";

let originMs: number | null = null;

export function resetLiveSimClock() {
  originMs = Date.now();
  if (typeof window === "undefined") return originMs;
  try {
    window.localStorage.setItem(ORIGIN_KEY, String(originMs));
  } catch {
    /* private mode */
  }
  return originMs;
}

function simOrigin(): Date {
  if (typeof window === "undefined") return new Date();
  if (originMs == null) {
    try {
      const stored = window.localStorage.getItem(ORIGIN_KEY);
      const parsed = stored ? Number(stored) : NaN;
      originMs = Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
      window.localStorage.setItem(ORIGIN_KEY, String(originMs));
    } catch {
      originMs = Date.now();
    }
  }
  if (!Number.isFinite(originMs) || originMs <= 0) originMs = Date.now();
  return new Date(originMs);
}

function formatClock(date: Date): string {
  let hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const meridiem = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${meridiem}`;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function rewriteTime(start: Date, end: Date): string {
  if (start.getTime() === end.getTime()) return formatClock(start);
  return `${formatClock(start)} – ${formatClock(end)}`;
}

/** Real camp days, with every timed block shifted so Arrival = origin. */
export function shiftCampToNow(origin = simOrigin()): CampDay[] {
  const firstDay = campDays[0];
  const arrival =
    firstDay?.blocks.find((block) => block.id === "d1-arrival") ?? null;
  const anchor =
    firstDay && arrival ? eventDateTimes(firstDay, arrival) : null;
  if (!anchor) return campDays;

  const offset = origin.getTime() - anchor.start.getTime();

  return campDays.map((day, index) => {
    const blocks: ScheduleBlock[] = day.blocks.map((block) => {
      const times = eventDateTimes(day, block);
      if (!times) return block;
      const start = new Date(times.start.getTime() + offset);
      const end = new Date(times.end.getTime() + offset);
      return {
        ...block,
        time: rewriteTime(start, end),
        startMs: start.getTime(),
        endMs: end.getTime(),
      };
    });
    const starts = blocks
      .map((b) => b.startMs)
      .filter((ms): ms is number => ms != null);
    const dayStart = starts.length
      ? new Date(Math.min(...starts))
      : new Date(origin);
    const labelDate = index === 0 ? origin : dayStart;
    return {
      ...day,
      dateISO: isoDateKey(labelDate),
      dateLabel: `${formatDateLabel(labelDate)} (sim)`,
      blocks,
    };
  });
}
