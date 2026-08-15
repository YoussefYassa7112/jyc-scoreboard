"use client";

import { AnimatePresence, motion } from "framer-motion";

export type ToastKind = "success" | "error" | "reminder" | "started" | "ended";

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

export function AdminToasts({ toasts, onDismiss }: Props) {
  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[22rem]"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const success = toast.kind === "success";
          const reminder = toast.kind === "reminder";
          const started = toast.kind === "started";
          const ended = toast.kind === "ended";
          const label = success
            ? "Nice!"
            : started
              ? "Happening now"
              : ended
                ? "Just ended"
                : reminder
                  ? "Coming up"
                  : "Hold up";
          const emoji = success
            ? "⭐"
            : started
              ? "🔔"
              : ended
                ? "✅"
                : reminder
                  ? "⏰"
                  : "🤠";
          return (
            <motion.button
              key={toast.id}
              type="button"
              onClick={() => onDismiss(toast.id)}
              initial={{ opacity: 0, y: 22, scale: 0.92, rotate: -3 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                rotate: success ? 1.2 : started ? 0.4 : ended ? -0.4 : reminder ? 0.6 : -1.2,
              }}
              exit={{ opacity: 0, y: 14, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
              className={`pointer-events-auto w-full rounded-2xl border-2 px-4 py-3 text-left shadow-[0_16px_40px_rgba(42,31,20,0.22)] ${
                success
                  ? "border-emerald-400/50 bg-[#ecfdf3] text-emerald-800 dark:bg-[#123024] dark:text-emerald-200"
                  : started
                    ? "border-woody/50 bg-[#fff1e6] text-woody dark:bg-[#3a2218] dark:text-[#f0a46a]"
                    : ended
                      ? "border-saddle/25 bg-chip text-card-ink dark:border-white/15 dark:bg-[#1e293b] dark:text-slate-200"
                      : reminder
                        ? "border-[#1E6BB8]/45 bg-[#e8f3fc] text-[#1E6BB8] dark:bg-[#102033] dark:text-[#7dd3fc]"
                        : "border-woody/50 bg-[#fff1e6] text-woody dark:bg-[#3a2218] dark:text-[#f0a46a]"
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
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
