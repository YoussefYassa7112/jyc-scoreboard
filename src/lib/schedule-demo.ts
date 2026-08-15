import { campDays, type CampDay, type ScheduleBlock } from "@/data/schedule";
import { isoDateKey } from "@/lib/schedule-time";
import { LIVE_CAMP_SIM, shiftCampToNow } from "@/lib/schedule-sim";

export const DEMO_DAY_ID = "demo-today";
const ORIGIN_KEY = "camp-demo-schedule-origin";
const READY_KEY = "camp-demo-schedule-ready";

let enabled = false;
let originMs: number | null = null;

/** Flip on after mount so SSR HTML matches the first client paint. */
export function setDemoScheduleEnabled(on: boolean) {
  enabled = on;
  if (typeof window === "undefined") return;
  try {
    if (on) window.sessionStorage.setItem(READY_KEY, "1");
    else window.sessionStorage.removeItem(READY_KEY);
  } catch {
    /* private mode */
  }
}

function demoUnlocked() {
  if (enabled) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(READY_KEY) === "1";
  } catch {
    return false;
  }
}

export function resetDemoScheduleClock() {
  originMs = Date.now();
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ORIGIN_KEY, String(originMs));
  } catch {
    /* private mode */
  }
}

function demoOrigin(now: Date): Date {
  if (typeof window !== "undefined") {
    if (originMs == null) {
      try {
        const stored = window.sessionStorage.getItem(ORIGIN_KEY);
        originMs = stored ? Number(stored) : Date.now();
        window.sessionStorage.setItem(ORIGIN_KEY, String(originMs));
      } catch {
        originMs = Date.now();
      }
    }
    return new Date(originMs);
  }
  return now;
}

function formatClock(date: Date): string {
  let hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const meridiem = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${meridiem}`;
}

function rangeLabel(start: Date, end: Date) {
  return `${formatClock(start)} – ${formatClock(end)}`;
}

function demoBlock(
  id: string,
  title: string,
  start: Date,
  end: Date,
  extra: Partial<ScheduleBlock> = {},
): ScheduleBlock {
  return {
    id,
    title,
    time: rangeLabel(start, end),
    group: "all",
    section: "full",
    ...extra,
  };
}

function clampToDay(date: Date, origin: Date) {
  const startOfDay = new Date(origin);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(origin);
  endOfDay.setHours(23, 59, 0, 0);
  if (date < startOfDay) return startOfDay;
  if (date > endOfDay) return endOfDay;
  return date;
}

/**
 * Fake blocks pinned to the moment you opened the app (or hit Restart).
 * Red and Green can overlap each other; Everyone never overlaps a color track.
 */
export function buildDemoDay(now = new Date()): CampDay {
  const origin = demoOrigin(now);
  const at = (minutes: number, seconds = 0) =>
    clampToDay(
      new Date(origin.getTime() + minutes * 60_000 + seconds * 1000),
      origin,
    );

    const doneStart = at(-8);
    let doneEnd = at(0, -20);
    if (doneEnd.getTime() <= doneStart.getTime()) {
      doneEnd = new Date(Math.min(origin.getTime() - 1000, doneStart.getTime() + 60_000));
    }

    return {
    id: DEMO_DAY_ID,
    label: "Test day",
    dateLabel: "Today (test)",
    dateISO: isoDateKey(origin),
    mode: "split",
    blocks: [
      demoBlock(
        "demo-done",
        "Test · Event just ended",
        doneStart,
        doneEnd,
        {
          note: "This one is already over — it should look faded, not just say Done.",
          section: "morning",
        },
      ),
      demoBlock(
        "demo-live-red",
        "Test · Red happening now",
        at(-2),
        at(1, 30),
        {
          group: "red",
          section: "midday",
          note: "Overlaps the other Red event and Green — not Everyone.",
        },
      ),
      demoBlock(
        "demo-live-red-extra",
        "Test · Red also happening",
        at(-1),
        at(1),
        {
          group: "red",
          section: "midday",
          note: "Second Red event at the same time.",
        },
      ),
      demoBlock(
        "demo-live-green",
        "Test · Green happening now",
        at(-2),
        at(1, 30),
        {
          group: "green",
          section: "midday",
          note: "Overlaps Red — Everyone view should list both colors.",
        },
      ),
      demoBlock(
        "demo-soon",
        "Test · Reminder in a moment",
        at(2, 30),
        at(10),
        {
          section: "evening",
          note: "Everyone only — starts after Red/Green finish. Turn on reminders; this is inside the 15-minute window.",
        },
      ),
      demoBlock(
        "demo-next-red",
        "Test · Red later",
        at(11),
        at(15),
        {
          group: "red",
          section: "midday",
          note: "Red-only next, after the shared Everyone block.",
        },
      ),
      demoBlock(
        "demo-next-green",
        "Test · Green later",
        at(11),
        at(16),
        {
          group: "green",
          section: "midday",
          note: "Green-only next, after the shared Everyone block.",
        },
      ),
      demoBlock(
        "demo-later",
        "Test · In 20 minutes",
        at(20),
        at(30),
        {
          section: "evening",
          note: "Everyone again, after the color tracks. Keep reminders on — it should pop in about 5 minutes.",
        },
      ),
    ],
  };
}

function demoWanted(now: Date, allowDemo: boolean) {
  if (!allowDemo) return false;
  if (process.env.NODE_ENV !== "development") return false;
  const first = campDays[0];
  if (!first) return false;
  return isoDateKey(now) < first.dateISO;
}

/** Real camp days, plus a test day before camp starts (local dev only). */
export function getScheduleDays(now = new Date(), allowDemo = demoUnlocked()): CampDay[] {
  if (LIVE_CAMP_SIM) {
    if (typeof window === "undefined") return campDays;
    return shiftCampToNow();
  }
  if (!demoWanted(now, allowDemo)) return campDays;
  return [buildDemoDay(now), ...campDays];
}
