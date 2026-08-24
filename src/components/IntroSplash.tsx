"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { motion } from "framer-motion";

const SESSION_KEY = "camp-intro-seen";

const IntroReadyContext = createContext(true);

export function useIntroReady() {
  return useContext(IntroReadyContext);
}

function introAlreadySeen() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function IntroReadyProvider({ children }: { children: React.ReactNode }) {
  // Always start false so SSR and the first client paint match.
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);

  return (
    <IntroReadyContext.Provider value={ready}>
      <IntroSplash onReady={markReady} />
      {children}
    </IntroReadyContext.Provider>
  );
}

type Phase = "idle" | "in" | "out" | "done";

const FADE_MS = 700;

function IntroSplash({ onReady }: { onReady: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (introAlreadySeen()) {
      setPhase("done");
      onReady();
      return;
    }
    setPhase("in");
    const hide = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* private mode */
      }
      setPhase("out");
    }, 2800);
    return () => window.clearTimeout(hide);
  }, [onReady]);

  useEffect(() => {
    if (phase !== "out") return;
    const finish = window.setTimeout(() => {
      setPhase("done");
      onReady();
    }, FADE_MS);
    return () => window.clearTimeout(finish);
  }, [phase, onReady]);

  if (phase === "idle" || phase === "done") return null;

  return (
    // pointer-events-none is load-bearing: this overlay covers the tab bar for
    // its whole life plus the fade, and the board is already visible through the
    // fade, so without it the first tap after opening the app hits the splash.
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,#1e3a8a_0%,#0b1226_55%,#05070f_100%)] transition-opacity ease-in-out ${
        phase === "out" ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* Rising stars */}
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute text-yellow-200"
          style={{
            left: `${8 + (i * 37) % 84}%`,
            top: `${90 + (i % 5) * 4}%`,
            fontSize: `${10 + (i % 4) * 4}px`,
          }}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], y: -420 - (i % 6) * 20 }}
          transition={{
            duration: 2.2,
            delay: i * 0.05,
            ease: "easeOut",
          }}
        >
          ✦
        </motion.span>
      ))}

      <div className="relative z-10 px-6 text-center">
        <motion.div
          className="mx-auto mb-4 text-5xl sm:text-6xl"
          initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
        >
          🚀
        </motion.div>
        <motion.p
          className="display-font text-sm font-semibold uppercase tracking-[0.3em] text-sky-200 sm:text-base"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          Welcome to the JYC
        </motion.p>
        <motion.h1
          className="display-font mt-2 text-4xl font-bold text-white sm:text-5xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Camp Scoreboard
        </motion.h1>
        <motion.div
          className="mx-auto mt-5 h-1 w-28 overflow-hidden rounded-full bg-white/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-sky-300 via-yellow-300 to-orange-300"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.6, delay: 0.6, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </div>
  );
}
