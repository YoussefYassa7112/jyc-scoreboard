"use client";

import { Suspense } from "react";
import { ThemeProvider } from "@/lib/theme";
import { ControlDock } from "./ControlDock";
import { IntroReadyProvider } from "./IntroSplash";
import { NightSky } from "./NightSky";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <IntroReadyProvider>
        <NightSky />
        <Suspense fallback={null}>
          <ControlDock />
        </Suspense>
        {children}
      </IntroReadyProvider>
    </ThemeProvider>
  );
}
