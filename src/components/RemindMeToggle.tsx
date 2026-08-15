"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fadeSoft } from "@/lib/motion";

type Props = {
  enabled: boolean;
  onChange: (on: boolean) => void;
  /** Which track the reminders will follow, for the helper line. */
  trackLabel: string;
};

export function RemindMeToggle({ enabled, onChange, trackLabel }: Props) {
  const [hint, setHint] = useState<string | null>(null);

  function toggle() {
    if (enabled) {
      onChange(false);
      setHint("Reminders off.");
      return;
    }
    onChange(true);
    setHint(
      `On — popups when ${trackLabel} events are coming, starting, or ending. Keep this page open.`,
    );
  }

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(null), 6000);
    return () => window.clearTimeout(timer);
  }, [hint]);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        className={`btn-soft inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold ${
          enabled ? "border-[#2F8F4E]/60 text-[#2F8F4E]" : ""
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
          A message pops up on this page when something is coming, starting, or
          ending — works offline, no extra permissions. Leave the app open in a
          tab.
        </p>
      ) : null}
    </div>
  );
}
