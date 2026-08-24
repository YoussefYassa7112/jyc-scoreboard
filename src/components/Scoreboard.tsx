"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { easeSoft } from "@/lib/motion";
import {
  announceDueReminders,
  useEventReminders,
  useReminderOptIn,
  type DueReminder,
} from "@/lib/event-reminders";
import { showLocalNotification } from "@/lib/notify";
import {
  readMyTeamSnapshot,
  readStandingsCache,
  writeStandingsCache,
  dropMissingMyTeam,
  TEAM_CHANGED_EVENT,
  type MyTeamSnapshot,
} from "@/lib/offline";
import { diffStandings, type BoardAlert } from "@/lib/rank-alerts";
import type { StandingRow } from "@/lib/standings";
import { LIVE_CAMP_SIM } from "@/lib/schedule-sim";
import { useTheme } from "@/lib/theme";
import { useOnline } from "@/lib/use-online";
import { setPresentationMode, usePresentationMode } from "@/lib/presentation";
import { AdminToasts, type AdminToast } from "./AdminToasts";
import { BoardAlerts } from "./BoardAlerts";
import { CampStatStrip } from "./CampStatStrip";
import { useIntroReady } from "./IntroSplash";
import { BuildingMap } from "./BuildingMap";
import { CampPhotosButton } from "./CampPhotosButton";
import { CampSchedule } from "./CampSchedule";
import { OfflineBanner } from "./OfflineBanner";
import { OrbitArena } from "./OrbitArena";
import { ControlDock } from "./ControlDock";
import { SkyDecor } from "./SkyDecor";
import { StandingsList } from "./StandingsList";
import { ReachForTheSkyMarquee } from "./SurpriseFX";

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
    x: direction >= 0 ? 72 : -72,
    scale: 0.97,
  }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -48 : 48,
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

export function Scoreboard() {
  const { theme } = useTheme();
  const { on: presentationOn } = usePresentationMode();
  const online = useOnline();
  const [data, setData] = useState<StandingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [staleCache, setStaleCache] = useState(false);
  const [tab, setTab] = useState<BoardTab>("standings");
  const presenting = presentationOn && tab === "standings";
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

  // Last standings the camper already saw. Seeded from the phone cache so a
  // rank change while the portal was closed still gets announced on reopen.
  const lastLiveStandings = useRef<StandingRow[] | null>(null);
  const myTeamIdRef = useRef<number | null>(null);
  const pendingReveal = useRef<StandingsResponse | null>(null);
  const queuedAlerts = useRef<BoardAlert[]>([]);
  const lastEtag = useRef<string | null>(null);
  /** Revision of the payload currently on screen, so identical 200s are dropped. */
  const lastAppliedRev = useRef<string | null>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const introReady = useIntroReady();
  const introReadyRef = useRef(introReady);
  introReadyRef.current = introReady;

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
    dropMissingMyTeam(pending.standings);
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
    if (!introReady || queuedAlerts.current.length === 0) return;
    const incoming = queuedAlerts.current;
    queuedAlerts.current = [];
    pushAlerts(incoming);
  }, [introReady, pushAlerts]);

  useEffect(() => {
    if (!introReady || queuedAlerts.current.length > 0) return;
    if (alerts.length === 0) revealPending();
  }, [alerts.length, introReady, revealPending]);

  /** Diff each live snapshot against the last one this phone already showed. */
  const trackStandings = useCallback(
    (json: StandingsResponse) => {
      dropMissingMyTeam(json.standings);
      const previous =
        lastLiveStandings.current ?? readStandingsCache()?.standings ?? null;
      lastLiveStandings.current = json.standings;
      if (!previous) {
        setData(json);
        dropMissingMyTeam(json.standings);
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
        if (holdForMessage && !alreadyHolding) {
          if (introReadyRef.current) pushAlerts(incoming);
          else queuedAlerts.current = incoming;
        }
        return;
      }

      setData(json);
      dropMissingMyTeam(json.standings);
    },
    [pushAlerts],
  );

  const reminderGroup =
    myTeam?.campGroup === "red" || myTeam?.campGroup === "green"
      ? myTeam.campGroup
      : "overview";
  const reminderCabinId =
    typeof myTeam?.cabinId === "number" ? myTeam.cabinId : null;

  const pushReminderToast = useCallback((reminder: DueReminder) => {
    const id = `reminder-${reminder.key}-${Date.now()}`;
    const kind: AdminToast["kind"] =
      reminder.phase === "started" ? "started" : "reminder";
    setToasts((current) =>
      [
        ...current.filter((toast) => toast.id !== id),
        {
          id,
          kind,
          title: reminder.title,
          detail: reminder.body,
        },
      ].slice(-4),
    );
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

  useEventReminders(reminderGroup, remindersOn, pushReminderToast, reminderCabinId);

  function goToTab(next: BoardTab) {
    const from = TABS.findIndex((t) => t.id === tab);
    const to = TABS.findIndex((t) => t.id === next);
    if (tab === "map" && next !== "map") setMapFocus(null);
    // Presentation is a standings-only view. Map and Schedule stay normal.
    if (next !== "standings" && presentationOn) setPresentationMode(false);
    setTabDirection(to >= from ? 1 : -1);
    setTab(next);
    // Pointer taps leave focus on the button; on mobile that can paint the
    // browser's default focus ring as a stray rectangle above the nav.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  useEffect(() => {
    if (!presentationOn) return;
    setScheduleFocus(null);
    setTab("standings");
  }, [presentationOn]);

  const clearMapFocus = useCallback(() => setMapFocus(null), []);
  const clearScheduleFocus = useCallback(() => setScheduleFocus(null), []);

  // Hydrate last standings so Schedule personalization works immediately offline.
  useEffect(() => {
    const cached = readStandingsCache();
    if (!cached) return;
    lastLiveStandings.current = cached.standings;
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
            if (!lastLiveStandings.current) {
              lastLiveStandings.current = cached.standings;
            }
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
          // A 200 whose revision matches what is already on screen is a
          // no-op. Applying it anyway would re-render the whole board and
          // run a synchronous JSON.stringify into localStorage once a
          // second — main-thread work that lands on top of whatever the
          // camper is tapping. Only skipped when the payload is genuinely
          // identical, so nothing live is ever held back.
          const unchanged =
            json.rev != null && json.rev === lastAppliedRev.current;
          if (unchanged) {
            setStaleCache(false);
            setError(null);
            setLoading(false);
            return;
          }
          lastAppliedRev.current = json.rev ?? null;
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
    window.addEventListener("pageshow", onVis);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
    };
    // `data` intentionally omitted — only gate polling on connectivity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, tab]);

  const liveLabel =
    online && !staleCache
      ? "Live standings"
      : online
        ? "Standings"
        : "Cached standings";

  return (
    <main
      className={`relative overflow-x-hidden ${
        presenting
          ? "flex min-h-dvh flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.65rem,env(safe-area-inset-top))] sm:px-5 md:h-dvh md:overflow-hidden md:px-6 md:py-3"
          : "min-h-dvh px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 md:px-10 md:py-10"
      }`}
    >
      <SkyDecor />

      <div
        className={`relative z-10 mx-auto flex w-full flex-col ${
          presenting
            ? "min-h-0 max-w-7xl flex-1 gap-3 md:gap-2"
            : "max-w-3xl gap-5 md:max-w-5xl md:gap-7"
        }`}
      >
        {/* Presenting has to fit one screen, so the dock rides in the header
            row instead of costing its own band above it. */}
        {presenting ? null : <ControlDock />}

        {presenting ? (
          <header className="flex shrink-0 flex-col gap-2 md:flex-row md:items-start md:gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2 min-[880px]:flex-row min-[880px]:items-end min-[880px]:gap-5">
              <div className="min-w-0 shrink-0">
                <p className="display-font text-[10px] font-semibold uppercase tracking-[0.2em] text-muted sm:text-xs md:hidden">
                  Welcome to the JYC
                </p>
                <h1 className="display-font text-2xl font-bold leading-tight text-ink sm:text-3xl">
                  Camp Scoreboard
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-muted sm:text-sm">
                  <span
                    className={`live-dot inline-block h-2 w-2 rounded-full ${
                      online && !staleCache ? "bg-red-500" : "bg-muted-soft"
                    }`}
                  />
                  <span>{liveLabel}</span>
                  {data?.asOf ? (
                    <span className="font-semibold text-muted-soft">
                      · {formatAsOf(data.asOf)}
                    </span>
                  ) : null}
                </div>
                {LIVE_CAMP_SIM ? (
                  <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-star">
                    Simulation preview
                  </p>
                ) : null}
              </div>
              <ReachForTheSkyMarquee
                compact
                className="mt-0 min-w-0 w-full max-w-none min-[880px]:flex-1"
              />
            </div>
            {/* Phone keeps the dock on its own row; from md up it tucks into the
                header row so the whole board still fits one screen. */}
            <div className="order-first flex shrink-0 justify-end md:order-none">
              <ControlDock />
            </div>
          </header>
        ) : (
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
                {isDark ? "🪐" : "🤠"}
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
              <span>{liveLabel}</span>
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
        )}

        <OfflineBanner
          online={online}
          detail={
            tab === "standings"
              ? "Needs WiFi for live scores. Showing the last standings saved on this device. Map & Schedule still work."
              : "Needs WiFi for live scores. Map & Schedule still work on this device."
          }
        />

        <LayoutGroup id="board-tabs">
        <nav
          className="panel flex shrink-0 gap-1 overflow-hidden rounded-2xl p-1.5 sm:gap-1.5"
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
                className={`display-font relative flex-1 rounded-xl px-2 font-extrabold outline-none transition-colors sm:px-3 ${
                  presenting
                    ? "py-2 text-sm sm:text-base md:py-1.5 md:text-sm"
                    : "py-3 text-sm sm:py-2.5 sm:text-base"
                } ${
                  active
                    ? "text-on-star"
                    : "btn-chip cursor-pointer hover:brightness-105"
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
        </LayoutGroup>

        <AnimatePresence mode="wait" custom={tabDirection} initial={false}>
          <motion.div
            key={tab}
            custom={tabDirection}
            variants={panelVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: tab === "map" ? 0.48 : 0.28,
              ease: easeSoft,
            }}
            className={`flex flex-col ${
              presenting
                ? "min-h-0 flex-1 gap-3 overflow-y-auto md:overflow-hidden"
                : "gap-5 md:gap-7"
            }`}
          >
        {tab === "standings" && presenting ? (
          <>
            {loading && !data ? (
              <p className="panel rounded-3xl py-16 text-center text-lg font-bold text-muted">
                Opening the toy box…
              </p>
            ) : null}

            {error && !data ? (
              <p className="panel rounded-3xl py-16 text-center text-lg font-bold text-star">
                {error}
              </p>
            ) : null}

            {data && data.standings.length === 0 ? (
              <p className="panel rounded-3xl py-16 text-center text-lg font-bold text-muted">
                No teams yet — ask a counselor to set up the scoreboard!
              </p>
            ) : null}

            {data && data.standings.length > 0 ? (
              <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] items-stretch gap-3 md:h-full md:flex-1 md:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:gap-4">
                <section className="panel toy-box relative order-2 min-h-0 min-w-0 overflow-hidden rounded-3xl p-3 md:order-1 md:h-full md:overflow-y-auto">
                  <StandingsList standings={data.standings} presentation />
                </section>
                <div className="order-1 min-h-0 min-w-0 md:order-2 md:h-full">
                  <OrbitArena standings={data.standings} variant="stage">
                    <CampStatStrip
                      standings={data.standings}
                      layout="inset"
                    />
                  </OrbitArena>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {tab === "standings" && !presenting ? (
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
            <StandingsList standings={data.standings} />
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
            rosterAuthoritative={!staleCache && data != null}
            remindersOn={remindersOn}
            onRemindersChange={setRemindersOn}
            onTeamSwitch={(group, cabin) => {
              announceDueReminders(group, pushReminderToast, new Date(), {
                cabinId: cabin ?? reminderCabinId,
                forceLive: true,
              });
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

        {presenting ? null : (
          <div
            className={tab === "standings" ? "mt-5 md:mt-7" : "hidden"}
            aria-hidden={tab !== "standings"}
          >
            <OrbitArena standings={data?.standings ?? []} />
          </div>
        )}

        {presenting ? null : (
          <p className="qr-breathe mx-auto w-fit max-w-[min(100%,22rem)] rounded-full bg-cloud/90 px-3.5 py-1.5 text-center text-xs font-semibold text-muted shadow-sm sm:max-w-xl sm:text-sm dark:bg-[#152038]/90 dark:text-slate-300">
            Scan the camp QR anytime to check who&apos;s leading the adventure
          </p>
        )}
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
