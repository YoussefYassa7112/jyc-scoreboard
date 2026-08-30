"use client";

import { useEffect, useRef, useState } from "react";
import type { CampMessageRow } from "@/lib/messages";

const SEEN_KEY = "camp-notices-seen";

function readSeenId(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeSeenId(id: number) {
  try {
    window.localStorage.setItem(SEEN_KEY, String(id));
  } catch {
    /* private mode */
  }
}

function whenSent(iso: string) {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (!Number.isFinite(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(iso).toLocaleDateString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Camp-wide notices from staff.
 *
 * Sits above the tabs rather than inside one, so a notice is visible whichever
 * section the camper is on — an announcement nobody sees because they happened
 * to be on the Map is not an announcement.
 *
 * Collapsed it shows the newest one; tapping opens the recent history. The
 * unread count comes from the highest id this device has opened, so it survives
 * a reload without needing anything server-side.
 */
export function CampNotices({
  messages,
  onNewMessage,
}: {
  messages: CampMessageRow[];
  onNewMessage?: (message: CampMessageRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [seenId, setSeenId] = useState(0);
  const announced = useRef<Set<number>>(new Set());

  // Start from 0 so the server and first client paint agree, then read storage.
  useEffect(() => {
    setSeenId(readSeenId());
  }, []);

  // Only announce notices that turn up *while the app is open*.
  //
  // The first payload after opening is the current state, not news — toasting
  // it would fire a popup for every notice already on the board every time a
  // camper opened the app. So the first list seen becomes the baseline and is
  // recorded silently; the unread badge still marks it, which is the right
  // weight for something that arrived while they were away.
  const baselineTaken = useRef(false);
  useEffect(() => {
    if (messages.length === 0) return;
    if (!baselineTaken.current) {
      baselineTaken.current = true;
      for (const message of messages) announced.current.add(message.id);
      return;
    }
    if (!onNewMessage) return;
    for (const message of messages) {
      if (announced.current.has(message.id)) continue;
      announced.current.add(message.id);
      onNewMessage(message);
    }
  }, [messages, onNewMessage]);

  if (messages.length === 0) return null;

  const newest = messages[0];
  const unread = messages.filter((m) => m.id > seenId).length;

  const markRead = () => {
    const top = messages.reduce((max, m) => Math.max(max, m.id), 0);
    writeSeenId(top);
    setSeenId(top);
  };

  return (
    <section
      aria-label="Camp notices"
      className="panel toy-box overflow-hidden rounded-3xl"
    >
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) markRead();
        }}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start gap-3 p-3.5 text-left sm:p-4"
      >
        <span aria-hidden className="text-xl leading-none sm:text-2xl">
          📣
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="display-font text-sm font-extrabold uppercase tracking-[0.16em] text-muted-soft">
              Camp notice
            </span>
            {newest.pinned ? (
              <span className="rounded-full bg-star px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-on-star">
                Pinned
              </span>
            ) : null}
            {unread > 0 ? (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                {unread} new
              </span>
            ) : null}
            <span className="text-[11px] font-bold text-muted-soft">
              {whenSent(newest.createdAt)}
            </span>
          </span>
          <span
            className={`mt-1 block text-sm font-bold leading-snug text-ink sm:text-base ${
              open ? "" : "line-clamp-2"
            }`}
          >
            {newest.body}
          </span>
          {messages.length > 1 ? (
            <span className="mt-1 block text-[11px] font-extrabold text-star">
              {open ? "Hide earlier notices" : `See all ${messages.length}`}
            </span>
          ) : null}
        </span>
      </button>

      {open && messages.length > 1 ? (
        <ul className="space-y-2 border-t border-saddle/15 px-3.5 pb-3.5 pt-3 sm:px-4">
          {messages.slice(1).map((message) => (
            <li
              key={message.id}
              className="surface-card rounded-2xl border px-3 py-2"
            >
              <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted-soft">
                {message.pinned ? (
                  <span className="rounded-full bg-star px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-on-star">
                    Pinned
                  </span>
                ) : null}
                {whenSent(message.createdAt)}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-card-ink">
                {message.body}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
