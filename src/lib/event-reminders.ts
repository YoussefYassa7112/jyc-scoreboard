"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  eventDateTimes,
  findUpcomingEvent,
  type ScheduleTrack,
} from "@/lib/schedule-time";
import { getScheduleDays, setDemoScheduleEnabled } from "@/lib/schedule-demo";

const OPT_IN_KEY = "camp-reminders-on";
const SENT_KEY = "camp-reminders-sent";
const OPT_IN_EVENT = "camp-reminders-changed";

export const REMINDER_LEAD_MS = 15 * 60 * 1000;
const CHECK_INTERVAL_MS = 30_000;
/** Enough history to cover a camp without growing unbounded. */
const SENT_LIMIT = 60;

export type ReminderGroup = ScheduleTrack;

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
  title: string;
  body: string;
  minutes: number;
};

function trackLabel(group: ReminderGroup) {
  if (group === "red") return "Red";
  if (group === "green") return "Green";
  if (group === "all") return "Everyone";
  return "Camp";
}

/**
 * The next block for this track that starts within the lead window and hasn't
 * been announced yet. Pure so the timing rules can be tested with a fake clock.
 */
export function findDueReminder(
  group: ReminderGroup,
  now: Date,
  alreadySent: string[] = [],
): DueReminder | null {
  const next = findUpcomingEvent(group, now, getScheduleDays(now));
  if (next.kind !== "next") return null;

  const times = eventDateTimes(next.day, next.block);
  if (!times) return null;

  const msUntil = times.start.getTime() - now.getTime();
  if (msUntil <= 0 || msUntil > REMINDER_LEAD_MS) return null;

  const key = `${next.day.id}:${next.block.id}`;
  if (alreadySent.includes(key)) return null;

  const detail = [next.block.time, next.block.location]
    .filter(Boolean)
    .join(" · ");

  return {
    key,
    title: `In ${Math.max(1, Math.round(msUntil / 60_000))} min · ${next.block.title}`,
    body: [trackLabel(next.block.group), detail || "Check the camp schedule."]
      .filter(Boolean)
      .join(" · "),
    minutes: Math.max(1, Math.round(msUntil / 60_000)),
  };
}

/** Overview checks everyone + red + green so overlapping tracks each get a ping. */
export function findDueReminders(
  group: ReminderGroup,
  now: Date,
  alreadySent: string[] = [],
): DueReminder[] {
  const tracks: ReminderGroup[] =
    group === "overview" ? ["all", "red", "green"] : [group];
  const seen = new Set<string>(alreadySent);
  const due: DueReminder[] = [];
  for (const track of tracks) {
    const found = findDueReminder(track, now, [...seen]);
    if (!found || seen.has(found.key)) continue;
    seen.add(found.key);
    due.push(found);
  }
  return due;
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
 * Fires one in-app toast per upcoming block, 15 minutes ahead, for the track
 * the camper's team belongs to. The schedule ships with the app, so this needs
 * no network and keeps working offline — but it only runs while the app is open.
 */
export function useEventReminders(
  group: ReminderGroup,
  enabled: boolean,
  onDue?: (reminder: DueReminder) => void,
) {
  const onDueRef = useRef(onDue);
  onDueRef.current = onDue;

  useEffect(() => {
    setDemoScheduleEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function check() {
      if (typeof document !== "undefined" && document.hidden) return;
      const due = findDueReminders(group, new Date(), readSent());
      for (const reminder of due) {
        markSent(reminder.key);
        onDueRef.current?.(reminder);
      }
    }

    check();
    const id = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [group, enabled]);
}
