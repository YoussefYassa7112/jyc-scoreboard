"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { setPresentationMode } from "@/lib/presentation";
import { PresentationToggle } from "./PresentationToggle";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Houses the theme switch and Present button. Sits in normal page flow rather
 * than floating: a fixed corner chip drifted over the heading while scrolling
 * and swallowed taps meant for the board underneath.
 */
export function ControlDock() {
  const pathname = usePathname();
  const showPresent = pathname === "/";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPresentationMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex shrink-0 justify-end">
      <div className="control-dock flex items-center gap-1.5 rounded-full p-1.5">
        <ThemeToggle />
        {showPresent ? (
          <>
            <span aria-hidden className="control-dock-rule" />
            <PresentationToggle />
          </>
        ) : null}
      </div>
    </div>
  );
}
