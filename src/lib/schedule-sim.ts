import { campDays, type CampDay, type ScheduleBlock } from "@/data/schedule";
import { eventDateTimes, isoDateKey } from "@/lib/schedule-time";

/**
 * Preview-branch only. Do not merge to main — production must keep Sept dates.
 * Shifts the real 3-day camp so Arrival starts at the stored origin (now).
 * Origin lives in localStorage so closing the phone overnight keeps the clock.
 */
export const LIVE_CAMP_SIM = true;

const ORIGIN_KEY = "camp-live-sim-origin";

/**
 * Arrival lands this far ahead by default, so a fresh start shows the board as
 * it looks *before* camp — nothing running, Arrival counting down — and you get
 * to watch it tip over rather than opening straight into a camp already going.
 */
export const SIM_LEAD_IN_MS = 3 * 60 * 1000;

let originMs: number | null = null;

function writeOrigin(ms: number) {
  originMs = ms;
  if (typeof window === "undefined") return ms;
  try {
    window.localStorage.setItem(ORIGIN_KEY, String(ms));
  } catch {
    /* private mode */
  }
  return ms;
}

/** Restart the camp. Arrival begins after the lead-in; pass 0 to start now. */
export function resetLiveSimClock(leadInMs = SIM_LEAD_IN_MS) {
  return writeOrigin(Date.now() + leadInMs);
}

/**
 * Move the clock so a chosen block is starting right now.
 *
 * Every block is shifted by one constant offset from Arrival, so putting a
 * block at `now` is a matter of solving for the origin that does it — no
 * per-block bookkeeping, and the rest of the camp keeps its real spacing
 * around the point you jumped to.
 */
export function skipLiveSimTo(dayId: string, blockId: string) {
  const firstDay = campDays[0];
  const arrival =
    firstDay?.blocks.find((block) => block.id === "d1-arrival") ?? null;
  const anchor = firstDay && arrival ? eventDateTimes(firstDay, arrival) : null;
  const day = campDays.find((d) => d.id === dayId);
  const block = day?.blocks.find((b) => b.id === blockId);
  const target = day && block ? eventDateTimes(day, block) : null;
  if (!anchor || !target) return null;
  const fromArrival = target.start.getTime() - anchor.start.getTime();
  return writeOrigin(Date.now() - fromArrival);
}

/** Every block, flattened, for a "jump to" picker. */
export function simJumpTargets() {
  return campDays.flatMap((day) =>
    day.blocks.map((block) => ({
      dayId: day.id,
      blockId: block.id,
      label: `${day.label} · ${block.time} — ${block.title}`,
    })),
  );
}

function simOrigin(): Date {
  if (typeof window === "undefined") return new Date();
  if (originMs == null) {
    try {
      const stored = window.localStorage.getItem(ORIGIN_KEY);
      const parsed = stored ? Number(stored) : NaN;
      // A first visit gets the lead-in too, not just the Restart button — the
      // point of the dry run is to watch camp begin, which means opening the
      // board a few minutes before it does.
      originMs =
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : Date.now() + SIM_LEAD_IN_MS;
      window.localStorage.setItem(ORIGIN_KEY, String(originMs));
    } catch {
      originMs = Date.now() + SIM_LEAD_IN_MS;
    }
  }
  if (!Number.isFinite(originMs) || originMs <= 0) {
    originMs = Date.now() + SIM_LEAD_IN_MS;
  }
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
