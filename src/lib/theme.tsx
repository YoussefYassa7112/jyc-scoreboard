"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isAutoNight: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "camp-theme";

export function isNightHour(date = new Date()) {
  const hour = date.getHours();
  return hour >= 20 || hour < 6;
}

function resolveInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return isNightHour() ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);
  const [isAutoNight, setIsAutoNight] = useState(false);

  useEffect(() => {
    const initial = resolveInitialTheme();
    setThemeState(initial);
    setIsAutoNight(!window.localStorage.getItem(STORAGE_KEY) && isNightHour());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.classList.add("theme-ready");
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
  }, [theme, ready]);

  // If user hasn't locked a preference, follow 8pm / 6am automatically
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      if (window.localStorage.getItem(STORAGE_KEY)) {
        setIsAutoNight(false);
        return;
      }
      const next = isNightHour() ? "dark" : "light";
      setIsAutoNight(isNightHour());
      setThemeState((current) => (current === next ? current : next));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [ready]);

  const setTheme = useCallback((mode: ThemeMode) => {
    window.localStorage.setItem(STORAGE_KEY, mode);
    setIsAutoNight(false);
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, next);
      setIsAutoNight(false);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, isAutoNight }),
    [theme, setTheme, toggleTheme, isAutoNight],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
