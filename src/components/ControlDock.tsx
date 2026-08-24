"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { setPresentationMode } from "@/lib/presentation";
import { PresentationToggle } from "./PresentationToggle";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Gives the theme switch and Present button a single housing so they read as one
 * control instead of two buttons floating over the board.
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
    <div className="pointer-events-none fixed right-[max(0.65rem,env(safe-area-inset-right))] top-[max(0.65rem,env(safe-area-inset-top))] z-50 sm:right-5 sm:top-5">
      <div className="control-dock pointer-events-auto flex w-[7rem] flex-col gap-1.5 rounded-[1.4rem] p-1.5">
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
