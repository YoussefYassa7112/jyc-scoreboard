"use client";

import { ThemeProvider } from "@/lib/theme";
import { IntroReadyProvider } from "./IntroSplash";
import { NightSky } from "./NightSky";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <IntroReadyProvider>
        <NightSky />
        {children}
      </IntroReadyProvider>
    </ThemeProvider>
  );
}
