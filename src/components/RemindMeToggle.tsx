"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fadeSoft } from "@/lib/motion";
import {
  isIosDevice,
  isStandaloneApp,
  notifySupport,
  requestNotifyPermission,
} from "@/lib/notify";

type Props = {
  enabled: boolean;
  onChange: (on: boolean) => void;
  /** Which track the reminders will follow, for the helper line. */
  trackLabel: string;
};

export function RemindMeToggle({ enabled, onChange, trackLabel }: Props) {
  const [hint, setHint] = useState<string | null>(null);

  async function toggle() {
    if (enabled) {
      onChange(false);
      setHint("Reminders off.");
      return;
    }
    onChange(true);
    const support = notifySupport();
    if (support === "supported") {
      await requestNotifyPermission();
    }
    try {
      await navigator.wakeLock?.request("screen");
    } catch {
      /* unsupported or not visible */
    }
    if (isIosDevice() && !isStandaloneApp()) {
      setHint(
        `On — a popup 15 minutes before ${trackLabel} events. Keep this page open. For lock-screen alerts, Add to Home Screen, then open it from there.`,
      );
      return;
    }
    setHint(
      `On — a popup 15 minutes before ${trackLabel} events, and again when they start. Keep this page open.`,
    );
  }

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(null), 10000);
    return () => window.clearTimeout(timer);
  }, [hint]);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        className={`btn-soft inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold ${
          enabled ? "border-star/60 text-star" : ""
        }`}
      >
        <motion.span
          aria-hidden
          animate={enabled ? { rotate: [0, -18, 14, 0] } : { rotate: 0 }}
          transition={{
            duration: 1.4,
            repeat: enabled ? Infinity : 0,
            repeatDelay: 2.5,
          }}
        >
          {enabled ? "🔔" : "🔕"}
        </motion.span>
        {enabled ? "Reminders on" : "Remind me on this page"}
      </button>

      <AnimatePresence initial={false}>
        {hint ? (
          <motion.p
            key={hint}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={fadeSoft}
            className="overflow-hidden text-xs font-semibold text-muted-soft"
          >
            <span className="mt-1.5 block">{hint}</span>
          </motion.p>
        ) : null}
      </AnimatePresence>

      {enabled ? (
        <p className="mt-1.5 text-[11px] font-semibold text-muted-soft">
          One message at a time: 15 minutes before the next event, then again
          when it starts. Keep this page open on your phone — Safari pauses it
          if you switch apps.
        </p>
      ) : null}
    </div>
  );
}
