"use client";

import { ThemeProvider } from "@/lib/theme";
import { IntroSplash } from "./IntroSplash";
import { NightSky } from "./NightSky";
import { ThemeToggle } from "./ThemeToggle";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <IntroSplash />
      <NightSky />
      <ThemeToggle />
      {children}
    </ThemeProvider>
  );
}
