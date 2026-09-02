"use client";

import { useEffect, useRef, useState } from "react";

export type ToastKind =
  | "success"
  | "error"
  | "reminder"
  | "started"
  | "ended"
  | "notice";

export type AdminToast = {
  id: string;
  kind: ToastKind;
  title: string;
  detail?: string;
};

type Props = {
  toasts: AdminToast[];
  onDismiss: (id: string) => void;
};

/** How long the leaving animation is given before the node is dropped. */
const LEAVE_MS = 180;

/**
 * Keeps a toast rendered briefly after it leaves the list, so it can animate
 * out, then drops it.
 *
 * This is what AnimatePresence was doing. It is done by hand because framer
 * drives its exits with requestAnimationFrame, and on iOS that has repeatedly
 * turned out to be the difference between a component that behaves and one that
 * blinks — the same reason the map route, the collapsible panels and the header
 * emoji in this codebase are all plain keyframes.
 */
function useLeavingToasts(toasts: AdminToast[]) {
  const [rendered, setRendered] = useState(toasts);
  const timers = useRef(new Map<string, number>());
  // Mirror of what is on screen, so the effect never has to depend on the state
  // it sets — that dependency is an infinite render loop, because merging
  // always produces a fresh array and a fresh array is always a new state.
  const renderedRef = useRef(rendered);

  useEffect(() => {
    const live = new Map(toasts.map((t) => [t.id, t]));
    const previous = renderedRef.current;

    // Keep what is showing, refresh anything whose content changed, append new.
    const next = previous.map((t) => live.get(t.id) ?? t);
    for (const toast of toasts) {
      if (!next.some((t) => t.id === toast.id)) next.push(toast);
    }
    const unchanged =
      next.length === previous.length &&
      next.every((t, i) => t === previous[i]);
    if (!unchanged) {
      renderedRef.current = next;
      setRendered(next);
    }

    for (const toast of next) {
      const stillLive = live.has(toast.id);
      const timer = timers.current.get(toast.id);
      if (stillLive) {
        // It came back before its exit finished; cancel the exit.
        if (timer != null) {
          window.clearTimeout(timer);
          timers.current.delete(toast.id);
        }
        continue;
      }
      if (timer != null) continue;
      timers.current.set(
        toast.id,
        window.setTimeout(() => {
          timers.current.delete(toast.id);
          const remaining = renderedRef.current.filter((t) => t.id !== toast.id);
          renderedRef.current = remaining;
          setRendered(remaining);
        }, LEAVE_MS),
      );
    }
  }, [toasts]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, []);

  return { rendered, leaving: (id: string) => !live_has(toasts, id) };
}

function live_has(toasts: AdminToast[], id: string) {
  return toasts.some((t) => t.id === id);
}

export function AdminToasts({ toasts, onDismiss }: Props) {
  const { rendered, leaving } = useLeavingToasts(toasts);
  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-[max(0.5rem,env(safe-area-inset-top))] z-[95] flex flex-col gap-2 pr-[4.75rem] sm:inset-x-auto sm:right-6 sm:left-auto sm:w-[22rem] sm:pr-0 sm:top-[max(0.75rem,env(safe-area-inset-top))]"
      aria-live="polite"
    >
      {rendered.map((toast) => {
          const success = toast.kind === "success";
          const reminder = toast.kind === "reminder";
          const started = toast.kind === "started";
          const ended = toast.kind === "ended";
          const notice = toast.kind === "notice";
          const label = success
            ? "Nice!"
            : notice
              ? "Camp notice"
              : started
                ? "Happening now"
                : ended
                  ? "Just ended"
                  : reminder
                    ? "Time to go"
                    : "Hold up";
          const emoji = success
            ? "⭐"
            : notice
              ? "📣"
              : started
                ? "🔔"
                : ended
                  ? "✅"
                  : reminder
                    ? "⏰"
                    : "🤠";
          return (
            <button
              key={toast.id}
              type="button"
              data-leaving={leaving(toast.id)}
              onClick={() => onDismiss(toast.id)}
              className={`toast-card pointer-events-auto w-full rounded-2xl border-2 px-4 py-3 text-left shadow-[0_16px_40px_rgba(42,31,20,0.22)] ${
                success
                  ? "border-emerald-400/50 bg-[#ecfdf3] text-emerald-800 dark:bg-[#123024] dark:text-emerald-200"
                  : notice
                    ? "border-star/60 bg-[#fff4d6] text-[#5c4033] dark:bg-[#2a2414] dark:text-[#f0e2cc]"
                  : started
                    ? "border-red-500/60 bg-red-50 text-red-700 dark:bg-[#3f1010] dark:text-red-200"
                    : ended
                      ? "border-saddle/25 bg-chip text-card-ink dark:border-white/15 dark:bg-[#1e293b] dark:text-slate-200"
                      : reminder
                        ? "border-red-500/50 bg-red-50 text-red-700 dark:bg-[#3f1010] dark:text-red-200"
                        : "border-star/50 bg-[#f3ebe4] text-star dark:bg-[#1a2e14] dark:text-[#B8E062]"
              }`}
            >
              <p className="display-font text-sm font-extrabold">
                {label}
                <span className="ml-2 text-base">{emoji}</span>
              </p>
              <p className="mt-0.5 text-sm font-extrabold">{toast.title}</p>
              {toast.detail ? (
                <p className="mt-0.5 text-xs font-semibold opacity-80">
                  {toast.detail}
                </p>
              ) : null}
            </button>
          );
        })}
    </div>
  );
}
