"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  announceDueReminders,
  useEventReminders,
  useReminderOptIn,
  type DueReminder,
} from "@/lib/event-reminders";
import { showLocalNotification } from "@/lib/notify";
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
import { LIVE_CAMP_SIM } from "@/lib/schedule-sim";
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
  rev?: string;
};

const POLL_STANDINGS_MS = 1_000;
const POLL_OTHER_TAB_MS = 4_000;

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
    blockId?: string;
  } | null>(null);
  const [scheduleFocus, setScheduleFocus] = useState<{
    dayId: string;
    blockId: string;
    group: "all" | "red" | "green";
    scrollNonce: number;
    fromFloorId?: string;
    fromRoomId?: string;
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
  const pendingReveal = useRef<StandingsResponse | null>(null);
  const lastEtag = useRef<string | null>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

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

  const revealPending = useCallback(() => {
    const pending = pendingReveal.current;
    if (!pending) return;
    pendingReveal.current = null;
    setData(pending);
    writeStandingsCache(pending);
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

  useEffect(() => {
    if (alerts.length === 0) revealPending();
  }, [alerts.length, revealPending]);

  /** Diff each live snapshot against the previous one, never per point event. */
  const trackStandings = useCallback(
    (json: StandingsResponse) => {
      const previous = lastLiveStandings.current;
      lastLiveStandings.current = json.standings;
      if (!previous) {
        setData(json);
        return;
      }

      const incoming = diffStandings(
        previous,
        json.standings,
        myTeamIdRef.current,
      );
      const holdForMessage = incoming.some(
        (alert) => alert.kind === "leader" || alert.kind === "team",
      );
      const alreadyHolding = pendingReveal.current != null;

      if (holdForMessage || alreadyHolding) {
        pendingReveal.current = json;
        if (holdForMessage && !alreadyHolding) pushAlerts(incoming);
        return;
      }

      setData(json);
    },
    [pushAlerts],
  );

  const reminderGroup =
    myTeam?.campGroup === "red" || myTeam?.campGroup === "green"
      ? myTeam.campGroup
      : "overview";

  const pushReminderToast = useCallback((reminder: DueReminder) => {
    const id = `reminder-${reminder.key}`;
    const kind = reminder.phase === "started" ? "started" : "reminder";
    setToasts((current) => [
      ...current.filter(
        (toast) =>
          toast.kind !== "reminder" &&
          toast.kind !== "started" &&
          toast.kind !== "ended",
      ),
      {
        id,
        kind,
        title: reminder.title,
        detail: reminder.body,
      },
    ]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 14_000);
    try {
      navigator.vibrate?.([180, 70, 180]);
    } catch {
      /* unsupported */
    }
    void showLocalNotification(
      reminder.phase === "started" ? "Happening now" : "Time to go",
      { body: `${reminder.title}. ${reminder.body}`, tag: reminder.key },
    );
  }, []);

  useEventReminders(reminderGroup, remindersOn, pushReminderToast);

  function goToTab(next: BoardTab) {
    const from = TABS.findIndex((t) => t.id === tab);
    const to = TABS.findIndex((t) => t.id === next);
    if (tab === "map" && next !== "map") setMapFocus(null);
    setTabDirection(to >= from ? 1 : -1);
    setTab(next);
  }

  const clearMapFocus = useCallback(() => setMapFocus(null), []);
  const clearScheduleFocus = useCallback(() => setScheduleFocus(null), []);

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
    const controller = new AbortController();

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
        const headers: HeadersInit = {};
        if (lastEtag.current) headers["If-None-Match"] = lastEtag.current;
        const res = await fetch("/api/standings", {
          headers,
          signal: controller.signal,
        });
        if (cancelled) return;
        if (res.status === 304 || res.status === 204) {
          setStaleCache(false);
          setError(null);
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error("Failed to load");
        const raw = await res.text();
        if (!raw) return;
        const json = JSON.parse(raw) as StandingsResponse;
        const etag = res.headers.get("etag");
        if (etag) lastEtag.current = etag;
        else if (json.rev) lastEtag.current = `"${json.rev}"`;
        if (!cancelled) {
          trackStandings(json);
          if (!pendingReveal.current) writeStandingsCache(json);
          setStaleCache(false);
          setError(null);
          setLoading(false);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
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

    load();
    if (!online) {
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    let id = 0;
    const startPolling = () => {
      window.clearInterval(id);
      const ms =
        tabRef.current === "standings" ? POLL_STANDINGS_MS : POLL_OTHER_TAB_MS;
      id = window.setInterval(load, ms);
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
      controller.abort();
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
    // `data` intentionally omitted — only gate polling on connectivity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, tab]);

  return (
    <main className="relative min-h-dvh overflow-x-hidden px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 md:px-10 md:py-10">
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

          <p className="display-font px-10 text-xs font-semibold uppercase tracking-[0.18em] text-muted sm:px-0 sm:text-base sm:tracking-[0.28em]">
            Welcome to the JYC
          </p>
          <h1 className="display-font mt-2 px-8 text-[2rem] font-bold leading-tight text-ink drop-shadow-sm sm:px-0 sm:text-5xl md:text-6xl">
            Camp Scoreboard
          </h1>
          {LIVE_CAMP_SIM ? (
            <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.18em] text-star">
              Simulation preview — not the public camp site
            </p>
          ) : null}

          <ReachForTheSkyMarquee />

          <div className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-muted sm:text-base">
            <span
              className={`live-dot inline-block h-2.5 w-2.5 rounded-full ${
                online && !staleCache ? "bg-red-500" : "bg-muted-soft"
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
                className={`display-font relative flex-1 rounded-xl px-2 py-3 text-sm font-extrabold transition-colors sm:px-3 sm:py-2.5 sm:text-base ${
                  active
                    ? "text-on-star"
                    : "cursor-pointer text-ink ring-1 ring-saddle/20 hover:bg-chip/70 hover:ring-saddle/35"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {active ? (
                  <motion.span
                    layoutId="board-tab-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-xl bg-star shadow-sm"
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
            <p className="py-16 text-center text-lg font-bold text-star">
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
                              ? "border-star/40 bg-card"
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
                            <p className="display-font truncate text-lg font-bold text-card-ink sm:text-2xl md:text-3xl">
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
                            className="display-font shrink-0 text-[1.65rem] font-bold tabular-nums leading-none text-card-ink sm:text-4xl md:text-5xl"
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

        {tab === "map" ? (
          <BuildingMap
            focusFloorId={mapFocus?.floorId}
            focusRoomId={mapFocus?.roomId}
            focusArrivalNonce={mapFocus?.arrivalNonce}
            focusBlockId={mapFocus?.blockId}
            onFocusCleared={clearMapFocus}
            onOpenScheduleEvent={(dayId, blockId, group, from) => {
              setScheduleFocus({
                dayId,
                blockId,
                group,
                scrollNonce: Date.now(),
                fromFloorId: from.floorId,
                fromRoomId: from.roomId,
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
            onTeamSwitch={(group) => {
              announceDueReminders(group, pushReminderToast);
            }}
            focusDayId={scheduleFocus?.dayId}
            focusBlockId={scheduleFocus?.blockId}
            focusGroup={scheduleFocus?.group}
            focusFloorId={scheduleFocus?.fromFloorId}
            focusRoomId={scheduleFocus?.fromRoomId}
            scrollNonce={scheduleFocus?.scrollNonce}
            onScheduleFocusConsumed={clearScheduleFocus}
            onViewLocation={(payload) => {
              if (payload.mapped && payload.floorId && payload.roomId) {
                setMapFocus({
                  floorId: payload.floorId,
                  roomId: payload.roomId,
                  arrivalNonce: Date.now(),
                  blockId: payload.blockId,
                });
                goToTab("map");
              }
            }}
          />
        ) : null}
          </motion.div>
        </AnimatePresence>

        <div
          className={tab === "standings" ? "mt-5 md:mt-7" : "hidden"}
          aria-hidden={tab !== "standings"}
        >
          <OrbitArena standings={data?.standings ?? []} />
        </div>

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
