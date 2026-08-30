"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  announceDueReminders,
  useEventReminders,
  useReminderOptIn,
  type DueReminder,
} from "@/lib/event-reminders";
import { showLocalNotification } from "@/lib/notify";
import {
  presentChromeVariants,
  presentHeaderVariants,
  presentLayoutTransition,
  presentStandingsVariants,
} from "@/lib/motion";
import {
  readMyTeamSnapshot,
  readStandingsCache,
  writeStandingsCache,
  dropMissingMyTeam,
  TEAM_CHANGED_EVENT,
  type MyTeamSnapshot,
} from "@/lib/offline";
import { diffStandings, type BoardAlert } from "@/lib/rank-alerts";
import type { CampMessageRow } from "@/lib/messages";
import type { StandingRow } from "@/lib/standings";
import { LIVE_CAMP_SIM } from "@/lib/schedule-sim";
import { useTheme } from "@/lib/theme";
import { useOnline } from "@/lib/use-online";
import { setPresentationMode, usePresentationMode } from "@/lib/presentation";
import { AdminToasts, type AdminToast } from "./AdminToasts";
import { BoardAlerts } from "./BoardAlerts";
import { CampNotices } from "./CampNotices";
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

/**
 * Panels used to swap through AnimatePresence `mode="wait"`, which forced the
 * outgoing panel to finish a 200ms exit *before* the incoming one was allowed
 * to mount — so the expensive mount started a fifth of a second after the tap.
 * The slide is a CSS keyframe now (see .board-panel in globals.css) that
 * replays when a panel goes display:none -> flex, and panels are kept alive
 * once visited so switching back is a display flip rather than a React mount.
 */

type StandingsResponse = {
  standings: StandingRow[];
  messages?: CampMessageRow[];
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
  const reduceMotion = useReducedMotion();
  const online = useOnline();
  const [data, setData] = useState<StandingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [staleCache, setStaleCache] = useState(false);
  // The nav paints from `tab`; the panel mounts from `panelTab` a frame later.
  // Mounting a panel is heavy — on a throttled phone the standings panel costs
  // ~1.5s of main-thread work — and while that sits in the same commit as the
  // highlight the browser cannot paint the new tab colours until it finishes.
  // That is the delay that reads as the label lagging behind the tap.
  const [tab, setTab] = useState<BoardTab>("standings");
  const [panelTab, setPanelTab] = useState<BoardTab>("standings");
  // Panels mount on first visit and are then kept, so only the first tap on
  // Map or Schedule ever pays a mount. Standings starts mounted because it is
  // what a camper scanning the QR lands on.
  const [mountedTabs, setMountedTabs] = useState<BoardTab[]>(["standings"]);
  const mountedTabsRef = useRef(mountedTabs);
  mountedTabsRef.current = mountedTabs;
  const panelFrame = useRef(0);
  const panelTimer = useRef(0);
  const navRef = useRef<HTMLElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  // Tracks the tab the camper just asked for, which the deferred state has not
  // caught up to yet, so a fast second tap still gets its slide direction right.
  //
  // The nav also *renders* from this ref rather than from `tab`. The click
  // handler writes `data-active` straight to the DOM for an immediate paint,
  // but the standings poll re-renders this component about once a second — and
  // a render still reading the old `tab` would put the stale value back on the
  // attribute and snap the highlight backwards.
  const pendingTab = useRef<BoardTab>("standings");
  const presenting = presentationOn && panelTab === "standings";
  const prevPresentingRef = useRef(presenting);
  const [presentAnimDir, setPresentAnimDir] = useState(1);
  useEffect(() => {
    if (prevPresentingRef.current === presenting) return;
    setPresentAnimDir(presenting ? 1 : -1);
    prevPresentingRef.current = presenting;
  }, [presenting]);
  const presentMotion = reduceMotion
    ? { duration: 0 }
    : presentLayoutTransition;
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
  const presentationOnRef = useRef(presentationOn);
  presentationOnRef.current = presentationOn;

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
  /** Revision currently on screen, so byte-identical 200s are dropped. */
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

  // Every timer this schedules is tracked so unmounting cannot leave a
  // setState firing into a dead component.
  const alertTimers = useRef<number[]>([]);
  useEffect(
    () => () => {
      alertTimers.current.forEach((id) => window.clearTimeout(id));
      alertTimers.current = [];
    },
    [],
  );

  const pushAlerts = useCallback((incoming: BoardAlert[]) => {
    if (incoming.length === 0) return;
    setAlerts((current) => [...current, ...incoming].slice(-3));
    for (const alert of incoming) {
      const life = alert.kind === "leader" ? 12000 : 8000;
      alertTimers.current.push(
        window.setTimeout(() => {
          setAlerts((current) => current.filter((a) => a.id !== alert.id));
        }, life),
      );
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

  const pushNoticeToast = useCallback((message: CampMessageRow) => {
    const id = `notice-${message.id}`;
    setToasts((current) =>
      [
        ...current.filter((toast) => toast.id !== id),
        { id, kind: "notice" as const, title: message.body },
      ].slice(-4),
    );
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 14_000);
    try {
      navigator.vibrate?.([120, 60, 120]);
    } catch {
      /* unsupported */
    }
    void showLocalNotification("Camp notice", {
      body: message.body,
      tag: id,
    });
  }, []);

  useEventReminders(reminderGroup, remindersOn, pushReminderToast, reminderCabinId);

  // Move the highlight on the DOM, then let React catch up two frames later.
  // A setState inside a click handler renders synchronously in that same task,
  // so the browser cannot paint until the render finishes — on a phone that is
  // long enough to read as the colour lagging behind the tap. Writing the
  // attribute directly keeps the handler cheap. Two frames because a rAF
  // callback still runs before the paint it precedes, so it takes a second one
  // to be sure the new highlight actually reached the screen first.
  const goToTab = useCallback(
    (next: BoardTab, opts?: { clearScheduleFocus?: boolean }) => {
      const current = pendingTab.current;
      const from = TABS.findIndex((t) => t.id === current);
      const to = TABS.findIndex((t) => t.id === next);
      const dir = to >= from ? 1 : -1;
      const leavingMap = current === "map" && next !== "map";
      pendingTab.current = next;

      navRef.current
        ?.querySelectorAll<HTMLElement>("[data-tab]")
        .forEach((el) => {
          el.dataset.active = String(el.dataset.tab === next);
        });

      // Reveal the target panel in the same task as the highlight, but only
      // once it has been visited before. On a first visit the panel element
      // exists while its contents do not, so flipping it here would blank the
      // board until React commits. In that one case the outgoing panel stays
      // put and React swaps both together.
      if (mountedTabsRef.current.includes(next)) {
        panelsRef.current
          ?.querySelectorAll<HTMLElement>("[data-panel]")
          .forEach((el) => {
            const isNext = el.dataset.panel === next;
            // Only stamp direction on a panel that is arriving; rewriting it on
            // the one already on screen replays the slide under the camper.
            if (isNext && el.dataset.active !== "true") {
              el.dataset.dir = dir >= 0 ? "forward" : "back";
            }
            el.dataset.active = String(isNext);
          });
      }

      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        if (opts?.clearScheduleFocus) setScheduleFocus(null);
        if (leavingMap) setMapFocus(null);
        // Presentation is a standings-only view. Map and Schedule stay normal.
        if (next !== "standings" && presentationOnRef.current) {
          setPresentationMode(false);
        }
        setTabDirection(dir);
        setMountedTabs((tabs) => (tabs.includes(next) ? tabs : [...tabs, next]));
        setTab(next);
        setPanelTab(next);
      };

      cancelAnimationFrame(panelFrame.current);
      window.clearTimeout(panelTimer.current);
      panelFrame.current = requestAnimationFrame(() => {
        panelFrame.current = requestAnimationFrame(commit);
      });
      // rAF does not fire while a tab is backgrounded or otherwise not
      // compositing — iOS low-power mode included — and without a backstop the
      // nav would sit on the new tab while the panel kept showing the old one,
      // with nothing to recover it. `commit` is idempotent, so whichever fires
      // first wins and the other is a no-op.
      panelTimer.current = window.setTimeout(commit, 120);
    },
    [],
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(panelFrame.current);
      window.clearTimeout(panelTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!presentationOn) return;
    goToTab("standings", { clearScheduleFocus: true });
  }, [presentationOn, goToTab]);

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
      // True when this attempt was cut short by the deadline below rather than
      // by the effect tearing down, which the catch has to tell apart.
      let timedOut = false;
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
        // navigator.onLine only catches the clean case. A camp access point
        // that is associated but has no uplink still reports online, and the
        // service worker waits ten seconds before falling back to cache — ten
        // seconds of spinner on a board that already has yesterday's standings
        // in localStorage. Give up sooner and show what we have.
        //
        // The deadline gets its own controller: the effect's controller is
        // shared by every poll, so aborting that one would leave it aborted
        // and kill all later refreshes rather than just this attempt.
        const attempt = new AbortController();
        const relay = () => attempt.abort();
        controller.signal.addEventListener("abort", relay, { once: true });
        const timeout = window.setTimeout(() => {
          timedOut = true;
          attempt.abort();
        }, 6000);
        const res = await fetch("/api/standings", {
          headers,
          signal: attempt.signal,
        }).finally(() => {
          window.clearTimeout(timeout);
          controller.signal.removeEventListener("abort", relay);
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
          // A 200 whose revision matches what is already on screen is a no-op.
          // Applying it anyway re-renders the whole board and runs a
          // synchronous JSON.stringify into localStorage once a second — main
          // thread work landing on top of whatever the camper is tapping.
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
        // An abort from the effect tearing down means nobody is listening any
        // more. An abort from the deadline means the network is dead and the
        // cache below is exactly what the camper should be looking at.
        const aborted =
          error instanceof DOMException && error.name === "AbortError";
        if (aborted && !timedOut) return;
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

  // Note on the missing `layout` prop below: framer animates *any* size change
  // of the element it sits on, and this board's height changes on every tab
  // switch — so the whole page slid vertically for the length of the layout
  // transition each time a tab was tapped. It was there for the Present-mode
  // transition, but Present is a rare projector action and tab taps are
  // constant, so the trade was the wrong way round. Present still animates via
  // the header/standings/chrome variants, which move opacity and translate
  // rather than measuring layout; only its size change snaps now.
  return (
    // The admin dashboard and the rank-alert overlays already honour
    // prefers-reduced-motion; the camper board did not, so its confetti, orbit
    // and panel springs ignored the OS setting entirely.
    <MotionConfig reducedMotion="user">
    <motion.main
      transition={presentMotion}
      className={`present-shell relative overflow-x-hidden ${
        presenting
          ? "flex min-h-dvh flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.65rem,env(safe-area-inset-top))] sm:px-5 md:h-dvh md:overflow-hidden md:px-6 md:py-3"
          : "min-h-dvh px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 md:px-10 md:py-10"
      }`}
    >
      <SkyDecor />

      <LayoutGroup id="scoreboard-present">
      <motion.div
        transition={presentMotion}
        className={`relative z-10 mx-auto flex w-full flex-col ${
          presenting
            ? "min-h-0 max-w-7xl flex-1 gap-3 md:gap-2"
            : "max-w-3xl gap-5 md:max-w-5xl md:gap-7"
        }`}
      >
        {/* Presenting has to fit one screen, so the dock rides in the header
            row instead of costing its own band above it. */}
        <AnimatePresence mode="wait" initial={false}>
          {presenting ? (
            <motion.div
              key="present-chrome"
              layout
              transition={presentMotion}
              variants={presentHeaderVariants}
              initial={reduceMotion ? false : "hidden"}
              animate="show"
              exit="exit"
              className="flex shrink-0 flex-col gap-2 md:flex-row md:items-start md:gap-3"
            >
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
              <motion.div
                layoutId="scoreboard-dock"
                transition={presentMotion}
                className="order-first flex shrink-0 justify-end md:order-none"
              >
                <ControlDock />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="normal-chrome"
              layout
              transition={presentMotion}
              variants={presentHeaderVariants}
              initial={reduceMotion ? false : "hidden"}
              animate="show"
              exit="exit"
              className="flex flex-col gap-5 md:gap-7"
            >
              <motion.div
                layoutId="scoreboard-dock"
                transition={presentMotion}
                className="shrink-0 self-end"
              >
                <ControlDock />
              </motion.div>

              <header className="text-center">
                <motion.div
                  className="mx-auto mb-2 flex items-center justify-center gap-3 text-2xl sm:text-3xl"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {/* Bobbed with framer until these went still on phones.
                      Two things stop an idle rAF loop that CSS keyframes ride
                      straight through: the reducedMotion="user" gate on the
                      board below, and iOS Low Power Mode, which both throttles
                      timers and reports reduced motion on its own — so a
                      camper on a flat battery, which by day three is most of
                      them, got a dead header they never asked to turn off.
                      These run on the compositor now and simply keep going.
                      It is a few pixels of bob on three emoji with nothing
                      moving underneath; the large travel that setting exists
                      to stop is elsewhere on this page and still respects it. */}
                  <span className="emoji-bob-spin">{isDark ? "🪐" : "🤠"}</span>
                  <span className="emoji-bob-pop">⭐</span>
                  <span className="emoji-bob-tilt">🚀</span>
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
            </motion.div>
          )}
        </AnimatePresence>

        <OfflineBanner
          online={online}
          detail={
            tab === "standings"
              ? "Needs WiFi for live scores. Showing the last standings saved on this device. Map & Schedule still work."
              : "Needs WiFi for live scores. Map & Schedule still work on this device."
          }
        />

        {/* Above the tabs on purpose: a notice only shown on one section is a
            notice half the camp never sees. */}
        {!presenting && data?.messages?.length ? (
          <CampNotices
            messages={data.messages}
            onNewMessage={pushNoticeToast}
          />
        ) : null}

        <nav
          ref={navRef}
          className="panel flex shrink-0 gap-1 rounded-2xl p-1.5 sm:gap-1.5"
          aria-label="Scoreboard sections"
        >
          {TABS.map((item) => {
            // Read the ref, not `tab`: a poll-driven render between the tap and
            // the deferred setState would otherwise write the previous tab back
            // onto data-active and snap the highlight backwards.
            const active = pendingTab.current === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-tab={item.id}
                data-active={active ? "true" : "false"}
                onClick={() => {
                  // Manual tab changes should never reuse a leftover map→schedule
                  // scroll/highlight intent.
                  goToTab(item.id, { clearScheduleFocus: true });
                }}
                className={`board-tab display-font flex-1 rounded-xl px-2 font-extrabold sm:px-3 ${
                  presenting
                    ? "py-2 text-sm sm:text-base md:py-1.5 md:text-sm"
                    : "py-3 text-sm sm:py-2.5 sm:text-base"
                }`}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
              >
                {/* Every visual state is pre-painted and swapped by opacity off
                    data-active, so pill and label change in the same compositor
                    frame however busy the main thread is. Colour cannot do that
                    — it needs a main-thread repaint, which is what made the
                    words trail the pill. Both label copies are aria-hidden; the
                    button carries the accessible name. */}
                <span className="board-tab-pill absolute bg-star shadow-sm" />
                <span className="board-tab-label" aria-hidden>
                  <span className="board-tab-label-on">{item.label}</span>
                  <span className="board-tab-label-off">{item.label}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div ref={panelsRef} className="contents">
          <div
            data-panel="standings"
            data-active={panelTab === "standings" ? "true" : "false"}
            data-dir={tabDirection >= 0 ? "forward" : "back"}
            className={`board-panel ${
              presenting
                ? "min-h-0 flex-1 gap-3 overflow-y-auto md:overflow-hidden"
                : "gap-5 md:gap-7"
            }`}
          >
        {/* standings panel */}
        {true ? (
          <AnimatePresence mode="wait" custom={presentAnimDir} initial={false}>
            {presenting ? (
              <motion.div
                key="standings-present"
                custom={presentAnimDir}
                variants={presentStandingsVariants}
                initial={reduceMotion ? false : "hidden"}
                animate="show"
                exit="exit"
                className="min-h-0 flex-1"
              >
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
              </motion.div>
            ) : (
              <motion.section
                key="standings-normal"
                custom={presentAnimDir}
                variants={presentStandingsVariants}
                initial={reduceMotion ? false : "hidden"}
                animate="show"
                exit="exit"
                className="panel toy-box relative overflow-hidden rounded-3xl p-3 sm:p-5 md:p-6"
              >
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
              </motion.section>
            )}
          </AnimatePresence>
        ) : null}

          </div>

          <div
            data-panel="map"
            data-active={panelTab === "map" ? "true" : "false"}
            data-dir={tabDirection >= 0 ? "forward" : "back"}
            className="board-panel gap-5 md:gap-7"
          >
        {mountedTabs.includes("map") ? (
          <BuildingMap
            active={panelTab === "map"}
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

          </div>

          <div
            data-panel="schedule"
            data-active={panelTab === "schedule" ? "true" : "false"}
            data-dir={tabDirection >= 0 ? "forward" : "back"}
            className="board-panel gap-5 md:gap-7"
          >
        {mountedTabs.includes("schedule") ? (
          <CampSchedule
            active={panelTab === "schedule"}
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
          </div>
        </div>

        {/* Mount/unmount is tied to Present mode only. Tying it to the tab as
            well meant every trip to Map or Schedule tore the orbit down and
            rebuilt it — a height change that fed the layout animation above,
            plus a full D3 re-setup on the way back. Hiding it keeps the arena
            alive; its IntersectionObserver parks the frame loop while hidden. */}
        <AnimatePresence initial={false}>
          {!presenting ? (
            <motion.div
              key="orbit-footer"
              variants={presentChromeVariants}
              initial={reduceMotion ? false : "hidden"}
              animate="show"
              exit="exit"
              className={panelTab === "standings" ? "mt-5 md:mt-7" : "hidden"}
              aria-hidden={panelTab !== "standings"}
            >
              <OrbitArena standings={data?.standings ?? []} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {!presenting ? (
            <motion.p
              key="qr-footer"
              variants={presentChromeVariants}
              initial={reduceMotion ? false : "hidden"}
              animate="show"
              exit="exit"
              className="qr-breathe mx-auto w-fit max-w-[min(100%,22rem)] rounded-full bg-cloud/90 px-3.5 py-1.5 text-center text-xs font-semibold text-muted shadow-sm sm:max-w-xl sm:text-sm dark:bg-[#152038]/90 dark:text-slate-300"
            >
              Scan the camp QR anytime to check who&apos;s leading the adventure
            </motion.p>
          ) : null}
        </AnimatePresence>
      </motion.div>
      </LayoutGroup>

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
    </motion.main>
    </MotionConfig>
  );
}
