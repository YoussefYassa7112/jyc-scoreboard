"use client";

import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, toggleTheme, isAutoNight } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex items-center gap-1.5">
      {isAutoNight ? (
        <span className="control-dock-note px-1.5">Auto</span>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
        className="dock-switch relative flex h-9 w-[4.75rem] items-center rounded-full"
      >
        <span
          aria-hidden
          className="dock-switch-knob absolute bottom-1 left-1 top-1 w-[calc(50%-0.5rem)] rounded-full"
          style={{
            transform: isDark
              ? "translateX(calc(100% + 0.5rem))"
              : "translateX(0)",
          }}
        />
        <span
          aria-hidden
          className="relative z-10 flex w-1/2 justify-center text-sm leading-none"
        >
          ☀️
        </span>
        <span
          aria-hidden
          className="relative z-10 flex w-1/2 justify-center text-sm leading-none"
        >
          🌙
        </span>
      </button>
    </div>
  );
}
