"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { fadeSoft, springSoft, springSnappy } from "@/lib/motion";
import type { BoardAlert } from "@/lib/rank-alerts";

const PIECES = ["🎉", "⭐", "🏆", "✨", "🚀", "👑", "🌟", "💫", "🎊", "🤠"];

function burstPieces(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: 26 }, (_, i) => {
    n = (Math.imul(n, 1664525) + 1013904223 + i) >>> 0;
    return {
      emoji: PIECES[n % PIECES.length],
      left: n % 100,
      delay: (n % 45) / 60,
      duration: 1.7 + (n % 14) / 10,
      drift: ((n % 21) - 10) * 10,
      size: n % 3 === 0 ? "text-4xl" : n % 3 === 1 ? "text-3xl" : "text-2xl",
    };
  });
}

function LeaderTakeover({
  alert,
  onDismiss,
}: {
  alert: BoardAlert;
  onDismiss: () => void;
}) {
  const pieces = burstPieces(alert.id);

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: fadeSoft }}
      role="dialog"
      aria-live="assertive"
      aria-labelledby={`board-alert-${alert.id}`}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute inset-0 bg-[#2a1f14]/70 backdrop-blur-md dark:bg-black/75"
      />

      {pieces.map((piece, index) => (
        <motion.span
          key={`${alert.id}-${index}`}
          aria-hidden
          className={`pointer-events-none absolute ${piece.size} drop-shadow-md`}
          style={{ left: `${piece.left}%`, top: "-8%" }}
          initial={{ y: 0, opacity: 0, rotate: 0, x: 0 }}
          animate={{
            y: "118vh",
            x: piece.drift,
            opacity: [0, 1, 1, 0],
            rotate: 280,
          }}
          transition={{
            duration: piece.duration + 1.4,
            delay: piece.delay,
            ease: "easeIn",
            repeat: 1,
          }}
        >
          {piece.emoji}
        </motion.span>
      ))}

      <motion.div
        initial={{ scale: 0.55, y: 48, rotate: -6 }}
        animate={{ scale: 1, y: 0, rotate: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 16 }}
        transition={springSnappy}
        className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border-4 border-[#E8B923] bg-cloud px-5 py-8 text-center shadow-[0_28px_90px_rgba(42,31,20,0.5)] sm:px-8 sm:py-10 dark:bg-[#152038]"
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#E8B923]/35 to-transparent"
          animate={{ x: ["-130%", "130%"] }}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.5 }}
        />

        <p className="relative text-xs font-extrabold uppercase tracking-[0.35em] text-woody sm:text-sm">
          {alert.mine ? "That's you" : "New leader"}
        </p>

        <motion.span
          aria-hidden
          className="relative mt-3 block text-7xl sm:text-8xl"
          animate={{
            scale: [1, 1.18, 1],
            rotate: [-10, 10, -10],
            y: [0, -8, 0],
          }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {alert.mine ? "🏆" : "👑"}
        </motion.span>

        <h2
          id={`board-alert-${alert.id}`}
          className="display-font relative mt-3 text-4xl font-bold leading-tight text-ink sm:text-5xl md:text-6xl"
        >
          {alert.mine ? "Your team is #1!" : (alert.teamName ?? alert.title)}
        </h2>
        <p className="display-font relative mt-2 text-2xl font-extrabold text-woody sm:text-3xl">
          {alert.mine
            ? alert.teamName
              ? `${alert.teamName} just took the lead`
              : "You just took the lead"
            : "just took 1st place!"}
        </p>
        {alert.detail ? (
          <p className="relative mt-3 text-base font-bold text-muted sm:text-lg">
            {alert.detail}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onDismiss}
          className="relative mt-6 rounded-2xl bg-woody px-5 py-2.5 text-sm font-extrabold text-on-strong shadow-md"
        >
          {alert.mine ? "We did it!" : "Let’s go!"}
        </button>
      </motion.div>
    </motion.div>
  );
}

function TeamTakeover({
  alert,
  onDismiss,
}: {
  alert: BoardAlert;
  onDismiss: () => void;
}) {
  const climbed = alert.direction !== "down";

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:items-center sm:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: fadeSoft }}
      role="dialog"
      aria-live="polite"
      aria-labelledby={`board-alert-${alert.id}`}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute inset-0 bg-[#2a1f14]/40 backdrop-blur-[2px] dark:bg-black/50"
      />

      <motion.div
        initial={{ scale: 0.86, y: 56 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 24 }}
        transition={springSoft}
        className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border-4 bg-cloud px-5 py-6 text-center shadow-[0_22px_70px_rgba(42,31,20,0.38)] sm:px-7 sm:py-8 dark:bg-[#152038]"
        style={{ borderColor: alert.color ?? "#C45C26" }}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-2.5"
          style={{ backgroundColor: alert.color ?? "#C45C26" }}
        />

        <motion.span
          aria-hidden
          className="block text-6xl sm:text-7xl"
          animate={{ y: climbed ? [0, -10, 0] : [0, 8, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {climbed ? "🚀" : "📉"}
        </motion.span>

        <h2
          id={`board-alert-${alert.id}`}
          className="display-font mt-3 text-3xl font-bold text-ink sm:text-4xl"
        >
          {alert.title}
        </h2>
        {alert.detail ? (
          <p className="mt-2 text-base font-bold text-muted sm:text-lg">
            {alert.detail}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 rounded-2xl bg-woody px-5 py-2.5 text-sm font-extrabold text-on-strong"
        >
          Nice
        </button>
      </motion.div>
    </motion.div>
  );
}

export function BoardAlerts({
  alerts,
  onDismiss,
}: {
  alerts: BoardAlert[];
  onDismiss: (id: string) => void;
}) {
  const shown = alerts.find((a) => a.kind === "leader") ?? alerts[0];

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {shown ? (
          shown.kind === "leader" ? (
            <LeaderTakeover
              key={shown.id}
              alert={shown}
              onDismiss={() => onDismiss(shown.id)}
            />
          ) : (
            <TeamTakeover
              key={shown.id}
              alert={shown}
              onDismiss={() => onDismiss(shown.id)}
            />
          )
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}
