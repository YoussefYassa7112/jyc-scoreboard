"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { setPresentationMode, usePresentationMode } from "@/lib/presentation";

export function PresentationToggle() {
  const pathname = usePathname();
  const { on, toggle } = usePresentationMode();

  useEffect(() => {
    if (!on) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPresentationMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on]);

  if (pathname !== "/") return null;

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
      className={`flex h-10 shrink-0 items-center gap-1 rounded-full border-2 px-2.5 shadow-lg sm:h-11 sm:gap-1.5 sm:px-3 ${
        on
          ? "border-star bg-star text-on-star"
          : "border-saddle/25 bg-cloud/90 text-ink dark:border-white/20 dark:bg-[#152038]/90"
      }`}
    >
      <span aria-hidden className="text-base">
        {on ? "📺" : "🪐"}
      </span>
      <span className="display-font text-[11px] font-extrabold uppercase tracking-wide">
        {on ? "Exit" : "Present"}
      </span>
    </button>
  );
}
