"use client";

import { Suspense } from "react";
import { ThemeProvider } from "@/lib/theme";
import { IntroReadyProvider } from "./IntroSplash";
import { NightSky } from "./NightSky";
import { PresentationToggle } from "./PresentationToggle";
import { ThemeToggle } from "./ThemeToggle";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <IntroReadyProvider>
        <NightSky />
        <div className="fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex flex-col items-end gap-1.5 sm:right-5 sm:top-5">
          <ThemeToggle />
          <Suspense fallback={null}>
            <PresentationToggle />
          </Suspense>
        </div>
        {children}
      </IntroReadyProvider>
    </ThemeProvider>
  );
}
