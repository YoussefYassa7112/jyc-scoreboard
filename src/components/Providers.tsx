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
        <div className="pointer-events-none fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.4rem,env(safe-area-inset-top))] z-50 sm:right-5 sm:top-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border-2 border-saddle/20 bg-cloud/85 p-1 shadow-lg backdrop-blur-md dark:border-white/15 dark:bg-[#152038]/85">
            <ThemeToggle />
            <Suspense fallback={null}>
              <PresentationToggle />
            </Suspense>
          </div>
        </div>
        {children}
      </IntroReadyProvider>
    </ThemeProvider>
  );
}
