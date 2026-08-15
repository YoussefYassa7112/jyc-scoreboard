"use client";

import { ThemeProvider } from "@/lib/theme";
import { IntroReadyProvider } from "./IntroSplash";
import { NightSky } from "./NightSky";
import { ThemeToggle } from "./ThemeToggle";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <IntroReadyProvider>
        <NightSky />
        <ThemeToggle />
        {children}
      </IntroReadyProvider>
    </ThemeProvider>
  );
}
