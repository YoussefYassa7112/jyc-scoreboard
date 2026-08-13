"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  readStandingsCache,
  writeStandingsCache,
} from "@/lib/offline";
import type { StandingRow } from "@/lib/standings";
import { useTheme } from "@/lib/theme";
import { useOnline } from "@/lib/use-online";
import { BuildingMap } from "./BuildingMap";
import { CampPhotosButton } from "./CampPhotosButton";
import { CampSchedule } from "./CampSchedule";
import { OfflineBanner } from "./OfflineBanner";
import { OrbitArena } from "./OrbitArena";
import { SkyDecor } from "./SkyDecor";
import { ReachForTheSkyMarquee, SurpriseFX } from "./SurpriseFX";

type BoardTab = "standings" | "map" | "schedule";

const TABS: { id: BoardTab; label: string }[] = [
  { id: "standings", label: "Standings" },
  { id: "map", label: "Map" },
  { id: "schedule", label: "Schedule" },
];

type StandingsResponse = {
  standings: StandingRow[];
  asOf: string;
};

function formatAsOf(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function needsDarkText(hex: string) {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return false;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.72;
}

export function Scoreboard() {
  const { theme } = useTheme();
  const online = useOnline();
  const [data, setData] = useState<StandingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [staleCache, setStaleCache] = useState(false);
  const [tab, setTab] = useState<BoardTab>("standings");
  const [mapFocus, setMapFocus] = useState<{
    floorId: string;
    roomId: string;
  } | null>(null);
  const [scheduleFocus, setScheduleFocus] = useState<{
    dayId: string;
    blockId: string;
    group: "all" | "red" | "green";
    scrollNonce: number;
  } | null>(null);
  const isDark = theme === "dark";

  // Hydrate last standings so Schedule personalization works immediately offline.
  useEffect(() => {
    const cached = readStandingsCache();
    if (!cached) return;
    setData({ standings: cached.standings, asOf: cached.asOf });
    setStaleCache(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!navigator.onLine) {
        const cached = readStandingsCache();
        if (!cancelled) {
          if (cached) {
            setData({ standings: cached.standings, asOf: cached.asOf });
            setStaleCache(true);
            setError(null);
          } else if (!data) {
            setError("Go online once to load standings. Map & Schedule still work.");
          }
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch("/api/standings", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const json = (await res.json()) as StandingsResponse;
        if (!cancelled) {
          setData(json);
          writeStandingsCache(json);
          setStaleCache(false);
          setError(null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          const cached = readStandingsCache();
          if (cached) {
            setData({ standings: cached.standings, asOf: cached.asOf });
            setStaleCache(true);
            setError(null);
          } else {
            setError("Could not load standings. Check your connection.");
          }
          setLoading(false);
        }
      }
    }

    load();
    if (!online) {
      return () => {
        cancelled = true;
      };
    }

    const id = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // `data` intentionally omitted — only gate polling on connectivity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  return (
    <main className="relative min-h-dvh overflow-x-hidden px-4 py-6 sm:px-6 md:px-10 md:py-10">
      {!isDark ? <SkyDecor /> : null}
      {!isDark ? <SurpriseFX /> : null}

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-5 md:max-w-5xl md:gap-7">
        <header className="text-center">
          <motion.div
            className="mx-auto mb-2 flex items-center justify-center gap-3 text-2xl sm:text-3xl"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.span
              animate={{ rotate: [-12, 12, -12], y: [0, -6, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            >
              {isDark ? "🌙" : "🤠"}
            </motion.span>
            <motion.span
              animate={{ y: [0, -10, 0], scale: [1, 1.12, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              ⭐
            </motion.span>
            <motion.span
              animate={{ rotate: [8, -8, 8], y: [0, -6, 0] }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.3,
              }}
            >
              🚀
            </motion.span>
          </motion.div>

          <p className="display-font text-sm font-semibold uppercase tracking-[0.28em] text-muted sm:text-base">
            Welcome to the JYC
          </p>
          <h1 className="display-font mt-2 text-4xl font-bold text-ink drop-shadow-sm sm:text-5xl md:text-6xl">
            Camp Scoreboard
          </h1>

          <ReachForTheSkyMarquee />

          <div className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-muted sm:text-base">
            <span
              className={`live-dot inline-block h-2.5 w-2.5 rounded-full ${
                online && !staleCache ? "bg-woody" : "bg-muted-soft"
              }`}
            />
            <span>
              {online && !staleCache
                ? "Live standings"
                : online
                  ? "Standings"
                  : "Cached standings"}
            </span>
            {data?.asOf ? (
              <span className="font-semibold text-muted-soft">
                · as of {formatAsOf(data.asOf)}
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex justify-center">
            <CampPhotosButton online={online} />
          </div>
        </header>

        <OfflineBanner
          online={online}
          detail={
            tab === "standings"
              ? "Showing the last scores saved on this phone. Go online for live updates. Map & Schedule still work."
              : "Map and Schedule still work. Live scores need WiFi."
          }
        />

        <nav
          className="panel flex gap-1 rounded-2xl p-1.5 sm:gap-1.5"
          aria-label="Scoreboard sections"
        >
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  // Manual tab changes should never reuse a leftover map→schedule
                  // scroll/highlight intent.
                  setScheduleFocus(null);
                  setTab(item.id);
                }}
                className={`display-font relative flex-1 rounded-xl px-2 py-2.5 text-sm font-extrabold transition sm:px-3 sm:text-base ${
                  active
                    ? "bg-woody text-on-strong shadow-sm"
                    : "text-ink hover:bg-chip/80"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {tab === "standings" ? (
        <section className="panel toy-box relative overflow-hidden rounded-3xl p-3 sm:p-5 md:p-6">
          <div className="pointer-events-none absolute -right-2 top-4 text-2xl opacity-45 sm:text-3xl">
            ✨
          </div>
          <div className="pointer-events-none absolute -left-1 bottom-2 text-2xl opacity-35 sm:text-3xl">
            🌟
          </div>

          {loading && !data ? (
            <p className="py-16 text-center text-lg font-bold text-muted">
              Opening the toy box…
            </p>
          ) : null}

          {error && !data ? (
            <p className="py-16 text-center text-lg font-bold text-woody">
              {error}
            </p>
          ) : null}

          {data && data.standings.length === 0 ? (
            <p className="py-16 text-center text-lg font-bold text-muted">
              No teams yet — ask a counselor to set up the scoreboard!
            </p>
          ) : null}

          {data && data.standings.length > 0 ? (
            <LayoutGroup>
              <ul className="flex flex-col gap-3 pt-2">
                <AnimatePresence initial={false}>
                  {data.standings.map((team) => {
                    const dark = needsDarkText(team.color);
                    const topThree = team.rank <= 3;
                    const isFirst = team.rank === 1;
                    const badge =
                      team.rank === 1
                        ? "👑"
                        : team.rank === 2
                          ? "⭐"
                          : team.rank === 3
                            ? "🚀"
                            : null;
                    return (
                      <motion.li
                        key={team.id}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{
                          layout: {
                            type: "spring",
                            stiffness: 380,
                            damping: 32,
                          },
                          opacity: { duration: 0.2 },
                        }}
                        className={`relative overflow-hidden rounded-2xl border-2 shadow-md ${
                          isFirst
                            ? "sheriff-glow border-saddle/20 bg-first-card"
                            : topThree
                              ? "border-woody/40 bg-card"
                              : "border-saddle/20 bg-card"
                        }`}
                      >
                        {isFirst ? (
                          <motion.div
                            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                            animate={{ x: ["-120%", "120%"] }}
                            transition={{
                              duration: 2.8,
                              repeat: Infinity,
                              repeatDelay: 2.2,
                              ease: "easeInOut",
                            }}
                          />
                        ) : null}

                        <div
                          className="absolute inset-y-0 left-0 w-2 sm:w-2.5"
                          style={{ backgroundColor: team.color }}
                        />
                        <div className="relative flex items-center gap-3 py-3 pl-5 pr-3 sm:gap-4 sm:py-4 sm:pl-6 sm:pr-5">
                          <div
                            className="display-font relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold sm:h-14 sm:w-14 sm:text-2xl"
                            style={{
                              backgroundColor: team.color,
                              color: dark ? "#2a1f14" : "#fff8ee",
                              boxShadow: topThree
                                ? "0 0 0 3px rgba(232, 185, 35, 0.55)"
                                : undefined,
                            }}
                          >
                            {team.rank}
                            {badge ? (
                              <motion.span
                                className="absolute -right-2 -top-2 text-base sm:text-lg"
                                animate={{
                                  y: [0, -3, 0],
                                  rotate: [-8, 8, -8],
                                }}
                                transition={{
                                  duration: 2.2,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              >
                                {badge}
                              </motion.span>
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="display-font truncate text-xl font-bold text-card-ink sm:text-2xl md:text-3xl">
                              {team.name}
                            </p>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-soft sm:text-sm">
                              Rank #{team.rank}
                              {isFirst ? " · 1st place" : ""}
                              {team.rank === 2 ? " · 2nd place" : ""}
                              {team.rank === 3 ? " · 3rd place" : ""}
                            </p>
                          </div>

                          <motion.div
                            key={`${team.id}-${team.score}`}
                            initial={{ scale: 1.2, rotate: -4 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{
                              type: "spring",
                              stiffness: 420,
                              damping: 16,
                            }}
                            className="display-font shrink-0 text-3xl font-bold tabular-nums text-card-ink sm:text-4xl md:text-5xl"
                          >
                            {team.score}
                          </motion.div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </LayoutGroup>
          ) : null}
        </section>
        ) : null}

        {tab === "standings" ? (
          <OrbitArena standings={data?.standings ?? []} />
        ) : null}

        {tab === "map" ? (
          <BuildingMap
            focusFloorId={mapFocus?.floorId}
            focusRoomId={mapFocus?.roomId}
            onOpenScheduleEvent={(dayId, blockId, group) => {
              setScheduleFocus({
                dayId,
                blockId,
                group,
                scrollNonce: Date.now(),
              });
              setTab("schedule");
            }}
          />
        ) : null}

        {tab === "schedule" ? (
          <CampSchedule
            teams={data?.standings ?? []}
            focusDayId={scheduleFocus?.dayId}
            focusBlockId={scheduleFocus?.blockId}
            focusGroup={scheduleFocus?.group}
            scrollNonce={scheduleFocus?.scrollNonce}
            onScheduleFocusConsumed={() => setScheduleFocus(null)}
            onViewLocation={(payload) => {
              if (payload.mapped && payload.floorId && payload.roomId) {
                setMapFocus({
                  floorId: payload.floorId,
                  roomId: payload.roomId,
                });
                setTab("map");
              }
            }}
          />
        ) : null}

        <motion.p
          className="text-center text-xs font-semibold text-muted-soft sm:text-sm"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3.5, repeat: Infinity }}
        >
          Scan the camp QR anytime to check who&apos;s leading the adventure
        </motion.p>
      </div>
    </main>
  );
}
