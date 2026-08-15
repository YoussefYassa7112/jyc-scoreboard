"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  useEventReminders,
  useReminderOptIn,
  type DueReminder,
} from "@/lib/event-reminders";
import { easeSoft } from "@/lib/motion";
import {
  readMyTeamSnapshot,
  readStandingsCache,
  writeStandingsCache,
  TEAM_CHANGED_EVENT,
  type MyTeamSnapshot,
} from "@/lib/offline";
import { diffStandings, type BoardAlert } from "@/lib/rank-alerts";
import type { StandingRow } from "@/lib/standings";
import { useTheme } from "@/lib/theme";
import { useOnline } from "@/lib/use-online";
import { AdminToasts, type AdminToast } from "./AdminToasts";
import { BoardAlerts } from "./BoardAlerts";
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

/** Panels travel in the direction of the tab you moved toward. */
const panelVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? 56 : -56,
    scale: 0.98,
  }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -40 : 40,
    scale: 0.98,
  }),
};

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
  const [tabDirection, setTabDirection] = useState(1);
  const [mapFocus, setMapFocus] = useState<{
    floorId: string;
    roomId: string;
    arrivalNonce: number;
  } | null>(null);
  const [scheduleFocus, setScheduleFocus] = useState<{
    dayId: string;
    blockId: string;
    group: "all" | "red" | "green";
    scrollNonce: number;
  } | null>(null);
  const isDark = theme === "dark";

  const [alerts, setAlerts] = useState<BoardAlert[]>([]);
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const [myTeam, setMyTeam] = useState<MyTeamSnapshot | null>(null);
  const [remindersOn, setRemindersOn] = useReminderOptIn();

  // Baseline for rank comparisons. Only live responses set it, so hydrating from
  // cache never fires a stale "new leader" alert.
  const lastLiveStandings = useRef<StandingRow[] | null>(null);
  const myTeamIdRef = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => {
      const snapshot = readMyTeamSnapshot();
      setMyTeam(snapshot);
      myTeamIdRef.current = snapshot?.teamId ?? null;
    };
    sync();
    window.addEventListener(TEAM_CHANGED_EVENT, sync);
    return () => window.removeEventListener(TEAM_CHANGED_EVENT, sync);
  }, []);

  const pushAlerts = useCallback((incoming: BoardAlert[]) => {
    if (incoming.length === 0) return;
    setAlerts((current) => [...current, ...incoming].slice(-3));
    for (const alert of incoming) {
      const life = alert.kind === "leader" ? 12000 : 8000;
      window.setTimeout(() => {
        setAlerts((current) => current.filter((a) => a.id !== alert.id));
      }, life);
    }
  }, []);

  /** Diff each live snapshot against the previous one, never per point event. */
  const trackStandings = useCallback(
    (next: StandingRow[]) => {
      const previous = lastLiveStandings.current;
      lastLiveStandings.current = next;
      if (!previous) return;
      pushAlerts(diffStandings(previous, next, myTeamIdRef.current));
    },
    [pushAlerts],
  );

  const reminderGroup =
    myTeam?.campGroup === "red" || myTeam?.campGroup === "green"
      ? myTeam.campGroup
      : "overview";

  const pushReminderToast = useCallback((reminder: DueReminder) => {
    const id = `reminder-${reminder.key}`;
    setToasts((current) => [
      ...current.filter((toast) => toast.id !== id).slice(-2),
      {
        id,
        kind: "reminder",
        title: reminder.title,
        detail: reminder.body,
      },
    ]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 12_000);
  }, []);

  useEventReminders(reminderGroup, remindersOn, pushReminderToast);

  function goToTab(next: BoardTab) {
    const from = TABS.findIndex((t) => t.id === tab);
    const to = TABS.findIndex((t) => t.id === next);
    setTabDirection(to >= from ? 1 : -1);
    setTab(next);
  }

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
        const res = await fetch("/api/standings");
        if (!res.ok) throw new Error("Failed to load");
        const json = (await res.json()) as StandingsResponse;
        if (!cancelled) {
          trackStandings(json.standings);
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

    let id = 0;
    const startPolling = () => {
      window.clearInterval(id);
      id = window.setInterval(load, 8_000);
    };
    const onVis = () => {
      if (document.hidden) {
        window.clearInterval(id);
        return;
      }
      void load();
      startPolling();
    };

    if (!document.hidden) startPolling();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
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
                  goToTab(item.id);
                }}
                className={`display-font relative flex-1 rounded-xl px-2 py-2.5 text-sm font-extrabold transition-colors sm:px-3 sm:text-base ${
                  active ? "text-on-strong" : "text-ink hover:bg-chip/60"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {active ? (
                  <motion.span
                    layoutId="board-tab-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-xl bg-woody shadow-sm"
                  />
                ) : null}
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <AnimatePresence mode="wait" custom={tabDirection} initial={false}>
          <motion.div
            key={tab}
            custom={tabDirection}
            variants={panelVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: easeSoft }}
            className="flex flex-col gap-5 md:gap-7"
          >
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
            focusArrivalNonce={mapFocus?.arrivalNonce}
            onOpenScheduleEvent={(dayId, blockId, group) => {
              setScheduleFocus({
                dayId,
                blockId,
                group,
                scrollNonce: Date.now(),
              });
              goToTab("schedule");
            }}
          />
        ) : null}

        {tab === "schedule" ? (
          <CampSchedule
            teams={data?.standings ?? []}
            remindersOn={remindersOn}
            onRemindersChange={setRemindersOn}
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
                  arrivalNonce: Date.now(),
                });
                goToTab("map");
              }
            }}
          />
        ) : null}
          </motion.div>
        </AnimatePresence>

        <motion.p
          className="text-center text-xs font-semibold text-muted-soft sm:text-sm"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3.5, repeat: Infinity }}
        >
          Scan the camp QR anytime to check who&apos;s leading the adventure
        </motion.p>
      </div>

      <AdminToasts
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((current) => current.filter((toast) => toast.id !== id))
        }
      />
      <BoardAlerts
        alerts={alerts}
        onDismiss={(id) =>
          setAlerts((current) => current.filter((a) => a.id !== id))
        }
      />
    </main>
  );
}
