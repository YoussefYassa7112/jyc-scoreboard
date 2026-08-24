"use client";

import { usePresentationMode } from "@/lib/presentation";
import { useTheme } from "@/lib/theme";

export function PresentationToggle() {
  const { on, toggle } = usePresentationMode();
  const { theme } = useTheme();

  const icon = on ? "📺" : theme === "dark" ? "🪐" : "🤠";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Exit presentation mode" : "Enter presentation mode"}
      title={
        on
          ? "Exit presentation (Esc)"
          : "Presentation mode — full standings stats and orbit"
      }
      className={`dock-button flex h-9 items-center justify-center gap-1 rounded-full px-3 ${
        on ? "dock-button-on" : ""
      }`}
    >
      <span aria-hidden className="text-sm leading-none">
        {icon}
      </span>
      <span className="display-font text-[10px] font-extrabold uppercase tracking-wide">
        {on ? "Exit" : "Present"}
      </span>
    </button>
  );
}
