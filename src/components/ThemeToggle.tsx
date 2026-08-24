"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, toggleTheme, isAutoNight } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="relative h-11 w-[4.5rem] overflow-hidden rounded-full border-2 border-saddle/25 bg-cloud/90 shadow-lg dark:border-white/20 dark:bg-[#152038]/90"
      >
        <motion.span
          className="absolute top-1 left-1 flex h-8 w-8 items-center justify-center rounded-full bg-horizon text-base shadow-md dark:bg-[#3b82f6]"
          animate={{ x: isDark ? 34 : 0 }}
          transition={{ type: "spring", stiffness: 700, damping: 38 }}
        >
          {isDark ? "🌙" : "☀️"}
        </motion.span>
        <span className="sr-only">Toggle theme</span>
      </button>
      {isAutoNight ? (
        <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur-sm">
          Auto night
        </span>
      ) : null}
    </div>
  );
}
