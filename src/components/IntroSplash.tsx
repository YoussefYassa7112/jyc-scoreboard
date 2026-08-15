"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

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
  const [ready, setReady] = useState(introAlreadySeen);
  const markReady = useCallback(() => setReady(true), []);

  return (
    <IntroReadyContext.Provider value={ready}>
      <IntroSplash onReady={markReady} />
      {children}
    </IntroReadyContext.Provider>
  );
}

function IntroSplash({ onReady }: { onReady: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (introAlreadySeen()) {
      onReady();
      return;
    }
    setShow(true);
    const hide = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* private mode */
      }
      setShow(false);
    }, 2800);
    return () => window.clearTimeout(hide);
  }, [onReady]);

  return (
    <AnimatePresence onExitComplete={onReady}>
      {show ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,#1e3a8a_0%,#0b1226_55%,#05070f_100%)]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          {/* Rising stars */}
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute text-yellow-200"
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
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
