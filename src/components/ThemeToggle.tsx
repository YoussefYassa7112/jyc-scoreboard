"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, toggleTheme, isAutoNight } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        isDark
          ? isAutoNight
            ? "Switch to light mode (auto night is on)"
            : "Switch to light mode"
          : "Switch to dark mode"
      }
      title={isAutoNight ? "Auto night — tap to switch" : undefined}
      className="relative h-10 w-[4.25rem] overflow-hidden rounded-full border-2 border-saddle/25 bg-cloud/90 shadow-lg sm:h-11 sm:w-[4.5rem] dark:border-white/20 dark:bg-[#152038]/90"
    >
      <motion.span
        className="absolute top-0.5 left-0.5 flex h-[1.85rem] w-[1.85rem] items-center justify-center rounded-full bg-horizon text-base shadow-md sm:top-1 sm:left-1 sm:h-8 sm:w-8 dark:bg-[#3b82f6]"
        animate={{ x: isDark ? 30 : 0 }}
        transition={{ type: "spring", stiffness: 700, damping: 38 }}
      >
        {isDark ? "🌙" : "☀️"}
      </motion.span>
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
