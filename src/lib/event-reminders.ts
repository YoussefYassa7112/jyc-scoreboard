"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  blocksForGroup,
  eventDateTimes,
  type ScheduleTrack,
} from "@/lib/schedule-time";
import { getScheduleDays, setDemoScheduleEnabled } from "@/lib/schedule-demo";

const OPT_IN_KEY = "camp-reminders-on";
const SENT_KEY = "camp-reminders-sent";
const OPT_IN_EVENT = "camp-reminders-changed";

export const REMINDER_LEAD_MS = 15 * 60 * 1000;
const CHECK_INTERVAL_MS = 4_000;
/** Enough history to cover a camp without growing unbounded. */
const SENT_LIMIT = 120;

export type ReminderGroup = ScheduleTrack;
export type ReminderPhase = "upcoming" | "started" | "ended";

function readOptIn() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(OPT_IN_KEY) === "1";
}

function writeOptIn(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(OPT_IN_KEY, "1");
    else window.localStorage.removeItem(OPT_IN_KEY);
    window.dispatchEvent(new CustomEvent(OPT_IN_EVENT));
  } catch {
    /* private mode */
  }
}

function readSent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markSent(key: string) {
  if (typeof window === "undefined") return;
  try {
    const next = [...readSent().filter((k) => k !== key), key].slice(-SENT_LIMIT);
    window.localStorage.setItem(SENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

/** Opt-in flag shared across components on this device. */
export function useReminderOptIn(): [boolean, (on: boolean) => void] {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readOptIn());
    const sync = () => setEnabled(readOptIn());
    window.addEventListener(OPT_IN_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(OPT_IN_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const set = useCallback((on: boolean) => {
    writeOptIn(on);
    setEnabled(on);
  }, []);

  return [enabled, set];
}

export type DueReminder = {
  key: string;
  phase: ReminderPhase;
  headline: string;
  title: string;
  body: string;
  minutes?: number;
};

type TimedItem = {
  dayId: string;
  block: {
    id: string;
    title: string;
    time?: string;
    location?: string;
    group: string;
  };
  start: number;
  end: number;
};

function trackLabel(group: ReminderGroup) {
  if (group === "red") return "Red";
  if (group === "green") return "Green";
  if (group === "all") return "Everyone";
  return "Camp";
}

function phaseKey(dayId: string, blockId: string, phase: ReminderPhase) {
  return `${dayId}:${blockId}:${phase}`;
}

function timedEvents(group: ReminderGroup, now: Date): TimedItem[] {
  const timed: TimedItem[] = [];
  for (const day of getScheduleDays(now)) {
    for (const block of blocksForGroup(day, group)) {
      const times = eventDateTimes(day, block);
      if (!times) continue;
      timed.push({
        dayId: day.id,
        block,
        start: times.start.getTime(),
        end: times.end.getTime(),
      });
    }
  }
  timed.sort((a, b) => a.start - b.start || a.end - b.end);
  return timed;
}

function reminderFromBlock(
  item: TimedItem,
  phase: ReminderPhase,
  nowMs: number,
): DueReminder {
  const detail = [item.block.time, item.block.location]
    .filter(Boolean)
    .join(" · ");
  const body = [trackLabel(item.block.group as ReminderGroup), detail || "Check the camp schedule."]
    .filter(Boolean)
    .join(" · ");
  const minutes = Math.max(1, Math.round((item.start - nowMs) / 60_000));

  if (phase === "started") {
    return {
      key: phaseKey(item.dayId, item.block.id, "started"),
      phase,
      headline: "Happening now",
      title: item.block.title,
      body,
    };
  }
  if (phase === "ended") {
    return {
      key: phaseKey(item.dayId, item.block.id, "ended"),
      phase,
      headline: "Just ended",
      title: item.block.title,
      body,
    };
  }
  return {
    key: phaseKey(item.dayId, item.block.id, "upcoming"),
    phase,
    headline: "Coming up",
    title: `In ${minutes} min · ${item.block.title}`,
    body,
    minutes,
  };
}

function isLive(item: TimedItem, nowMs: number) {
  return item.start <= nowMs && nowMs < item.end;
}

/**
 * One alert at a time, in this order: event started → event ended → next
 * upcoming (15 min). Opening the board with `previousNow` null catch-up
 * announces a live event (for late campers) or the next one that's close.
 */
export function findScheduleAlert(
  group: ReminderGroup,
  now: Date,
  alreadySent: string[] = [],
  previousNow: Date | null = null,
): DueReminder | null {
  const nowMs = now.getTime();
  const prevMs = previousNow?.getTime() ?? null;
  const timed = timedEvents(group, now);
  const sent = new Set(alreadySent);

  const started = timed.filter((item) => {
    if (sent.has(phaseKey(item.dayId, item.block.id, "started"))) return false;
    if (!isLive(item, nowMs)) return false;
    if (prevMs == null) return true;
    return prevMs < item.start;
  });
  if (started.length) {
    started.sort((a, b) => a.start - b.start);
    return reminderFromBlock(started[0]!, "started", nowMs);
  }

  if (prevMs != null) {
    const ended = timed.filter((item) => {
      if (sent.has(phaseKey(item.dayId, item.block.id, "ended"))) return false;
      return prevMs < item.end && item.end <= nowMs;
    });
    if (ended.length) {
      ended.sort((a, b) => b.end - a.end);
      return reminderFromBlock(ended[0]!, "ended", nowMs);
    }
  }

  const live = timed.some((item) => isLive(item, nowMs));
  if (live) return null;

  const next = timed.find((item) => item.start > nowMs);
  if (!next) return null;
  const msUntil = next.start - nowMs;
  if (msUntil > REMINDER_LEAD_MS) return null;
  if (sent.has(phaseKey(next.dayId, next.block.id, "upcoming"))) return null;
  return reminderFromBlock(next, "upcoming", nowMs);
}

/**
 * Upcoming-only helper (nothing live, next start within 15 minutes).
 */
export function findDueReminder(
  group: ReminderGroup,
  now: Date,
  alreadySent: string[] = [],
): DueReminder | null {
  const alert = findScheduleAlert(group, now, alreadySent, now);
  return alert?.phase === "upcoming" ? alert : null;
}

export function findDueReminders(
  group: ReminderGroup,
  now: Date,
  alreadySent: string[] = [],
): DueReminder[] {
  const found = findDueReminder(group, now, alreadySent);
  return found ? [found] : [];
}

/** Catch-up when a camper opens the board or switches teams. */
export function announceDueReminders(
  group: ReminderGroup,
  onDue: (reminder: DueReminder) => void,
  now = new Date(),
) {
  const due = findScheduleAlert(group, now, readSent(), null);
  if (!due) return;
  markSent(due.key);
  onDue(due);
}

export function clearRemindersForDay(dayId: string) {
  if (typeof window === "undefined") return;
  try {
    const next = readSent().filter((key) => !key.startsWith(`${dayId}:`));
    window.localStorage.setItem(SENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

/**
 * Upcoming / started / ended toasts for the camper's track. Runs on open,
 * every few seconds, and when the tab becomes visible again.
 */
export function useEventReminders(
  group: ReminderGroup,
  enabled: boolean,
  onDue?: (reminder: DueReminder) => void,
) {
  const onDueRef = useRef(onDue);
  onDueRef.current = onDue;
  const previousNowRef = useRef<Date | null>(null);

  useEffect(() => {
    setDemoScheduleEnabled(true);
  }, []);

  useEffect(() => {
    previousNowRef.current = null;
  }, [group]);

  useEffect(() => {
    if (!enabled) return;

    function check() {
      if (typeof document !== "undefined" && document.hidden) return;
      const now = new Date();
      const reminder = findScheduleAlert(
        group,
        now,
        readSent(),
        previousNowRef.current,
      );
      previousNowRef.current = now;
      if (!reminder) return;
      markSent(reminder.key);
      onDueRef.current?.(reminder);
    }

    check();
    const id = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVis = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [group, enabled]);
}
