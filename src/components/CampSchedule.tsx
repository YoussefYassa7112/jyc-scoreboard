"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { firstMappedLocationId, getLocation } from "@/data/locations";
import {
  greenCabins,
  redCabins,
  type CampDay,
  type ScheduleBlock,
} from "@/data/schedule";
import {
  clearRemindersForDay,
} from "@/lib/event-reminders";
import {
  DEMO_DAY_ID,
  getScheduleDays,
  resetDemoScheduleClock,
  setDemoScheduleEnabled,
} from "@/lib/schedule-demo";
import {
  readMyTeamSnapshot,
  writeMyTeamSnapshot,
  type MyTeamSnapshot,
} from "@/lib/offline";
import type { StandingRow } from "@/lib/standings";
import {
  blockStatus,
  eventCountdown,
  findCampDayForDate,
  findLiveEvents,
  findUpcomingEvent,
  findUpcomingExclusive,
  formatCountdown,
  isoDateKey,
  type BlockStatus,
  type ScheduleTrack,
} from "@/lib/schedule-time";
import { springSnappy } from "@/lib/motion";
import { NowNextBoard, type UpcomingLane } from "./NowNextBoard";
import { RemindMeToggle } from "./RemindMeToggle";

type TrackFilter = "overview" | "red" | "green";

type Props = {
  teams: StandingRow[];
  /** 15-minutes-before reminder opt-in, owned by the board */
  remindersOn?: boolean;
  onRemindersChange?: (on: boolean) => void;
  focusDayId?: string | null;
  focusBlockId?: string | null;
  focusGroup?: "all" | "red" | "green" | null;
  /** Only set when navigating from the map (or similar) — triggers one scroll */
  scrollNonce?: number | null;
  onScheduleFocusConsumed?: () => void;
  onViewLocation?: (payload: {
    locationId: string;
    mapped: boolean;
    floorId?: string;
    roomId?: string;
    label: string;
  }) => void;
};

function chromeClasses(chrome: "all" | "red" | "green") {
  if (chrome === "green") {
    return {
      cardBorder: "border-[#2F8F4E]/55 border-l-[#2F8F4E]",
      time: "text-[#2F8F4E]",
      ring: "ring-[#2F8F4E]",
      glowRgb: "47, 143, 78",
    };
  }
  if (chrome === "red") {
    return {
      cardBorder: "border-[#C45C26]/55 border-l-[#C45C26]",
      time: "text-[#C45C26]",
      ring: "ring-[#C45C26]",
      glowRgb: "196, 92, 38",
    };
  }
  return {
    cardBorder: "border-saddle/20 border-l-[#1E6BB8]",
    time: "text-[#1E6BB8]",
    ring: "ring-woody",
    glowRgb: "196, 92, 38",
  };
}

function BlockCard({
  block,
  accent,
  chrome,
  highlighted,
  status = "untimed",
  endsInMs,
  onViewMap,
}: {
  block: ScheduleBlock;
  accent: "all" | "red" | "green";
  /** Active track color — tints times/outlines for green vs red */
  chrome: "all" | "red" | "green";
  highlighted?: boolean;
  status?: BlockStatus;
  endsInMs?: number | null;
  onViewMap?: () => void;
}) {
  // Prefer the selected track color so shared "everyone" blocks match Red/Green.
  const colorKey = chrome !== "all" ? chrome : accent;
  const colors = chromeClasses(colorKey);
  const done = status === "done";
  const live = status === "live";

  return (
    <motion.article
      layout
      id={`schedule-block-${block.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={
        highlighted && !done
          ? {
              opacity: 1,
              y: 0,
              scale: [1, 1.02, 1, 1.015, 1],
              boxShadow: [
                `0 1px 2px 0 rgba(0,0,0,0.05), 0 0 0 0 rgba(${colors.glowRgb}, 0)`,
                `0 1px 2px 0 rgba(0,0,0,0.05), 0 0 0 12px rgba(${colors.glowRgb}, 0.3)`,
                `0 1px 2px 0 rgba(0,0,0,0.05), 0 0 0 0 rgba(${colors.glowRgb}, 0)`,
                `0 1px 2px 0 rgba(0,0,0,0.05), 0 0 0 12px rgba(${colors.glowRgb}, 0.24)`,
                `0 1px 2px 0 rgba(0,0,0,0.05), 0 0 0 0 rgba(${colors.glowRgb}, 0)`,
              ],
            }
          : { opacity: 1, y: 0, scale: 1 }
      }
      transition={highlighted && !done ? { duration: 2.2, ease: "easeInOut" } : springSnappy}
      className={`relative overflow-hidden rounded-2xl border border-l-4 p-3.5 text-card-ink shadow-sm sm:p-4 ${
        done
          ? "schedule-done border-[#8a8178]/40 border-l-[#8a8178] bg-[#ebe4da] dark:bg-card"
          : `bg-card ${colors.cardBorder}`
      } ${
        highlighted && !done
          ? `ring-2 ${colors.ring} ring-offset-2 ring-offset-transparent`
          : ""
      } ${live ? "ring-2 ring-woody/70" : ""}`}
    >
      <AnimatePresence>
        {done ? (
          <motion.span
            key="done"
            initial={{ scale: 1.7, rotate: -22, opacity: 0, x: 12 }}
            animate={{ scale: 1, rotate: -8, opacity: 1, x: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={springSnappy}
            className="absolute right-3 top-3 z-10 rounded-full bg-[#6b7280] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-md"
          >
            ✓ Done
          </motion.span>
        ) : null}
      </AnimatePresence>
      {live ? (
        <motion.span
          className="absolute right-3 top-3 z-10 rounded-full bg-woody px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-on-strong shadow-md"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          Happening now
        </motion.span>
      ) : null}

      {block.time ? (
        <p
          className={`text-xs font-extrabold uppercase tracking-wide sm:text-sm ${
            done ? "text-muted-soft line-through" : colors.time
          }`}
        >
          {block.time}
        </p>
      ) : null}
      <h4
        className={`display-font mt-0.5 pr-24 text-base font-bold sm:text-lg ${
          done ? "text-muted line-through decoration-2" : "text-card-ink"
        }`}
      >
        {block.title}
      </h4>
      {live && endsInMs != null ? (
        <p className="mt-1 text-sm font-extrabold tabular-nums text-woody">
          Ends in {formatCountdown(endsInMs)}
        </p>
      ) : null}
      {block.location ? (
        <p className={`mt-1 text-sm font-bold ${done ? "text-muted-soft" : "text-accent"}`}>
          <span className="text-muted-soft">Location · </span>
          {block.location}
        </p>
      ) : null}
      {block.note ? (
        <p className="mt-1 text-sm font-semibold text-muted-soft">{block.note}</p>
      ) : null}
      {block.details?.length ? (
        <ul className="mt-2 space-y-1.5">
          {block.details.map((line) => (
            <li
              key={line}
              className="rounded-xl bg-chip px-2.5 py-1.5 text-xs font-semibold text-chip-ink sm:text-sm"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {onViewMap && (block.locationIds?.length || block.location) ? (
        <button
          type="button"
          onClick={onViewMap}
          className="btn-soft mt-3 rounded-xl border px-3 py-1.5 text-xs font-extrabold"
        >
          View on map
        </button>
      ) : null}
    </motion.article>
  );
}

function Section({
  title,
  tint,
  chrome,
  day,
  now,
  blocks,
  cabins,
  highlightBlockId,
  onViewMapFor,
}: {
  title: string;
  tint: "all" | "red" | "green";
  chrome: "all" | "red" | "green";
  day: CampDay;
  now: Date;
  blocks: ScheduleBlock[];
  cabins?: string[];
  highlightBlockId?: string | null;
  onViewMapFor?: (block: ScheduleBlock) => void;
}) {
  if (blocks.length === 0) return null;

  const headerBg =
    tint === "red"
      ? "bg-[#C45C26] text-on-strong"
      : tint === "green"
        ? "bg-[#2F8F4E] text-on-strong"
        : "bg-[#1E6BB8] text-on-strong";

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl px-3.5 py-2.5 ${headerBg}`}>
        <h3 className="display-font text-lg font-bold text-on-strong sm:text-xl">
          {title}
        </h3>
        {cabins?.length ? (
          <p className="mt-1 text-xs font-semibold text-on-strong/90 sm:text-sm">
            Cabins: {cabins.join(" · ")}
          </p>
        ) : null}
      </div>
      <div className="space-y-2.5">
        {blocks.map((block) => {
          const status = blockStatus(day, block, now);
          const count = status === "live" ? eventCountdown(day, block, now) : null;
          return (
            <BlockCard
              key={block.id}
              block={block}
              accent={tint}
              chrome={chrome}
              status={status}
              endsInMs={count?.endsIn}
              highlighted={highlightBlockId === block.id}
              onViewMap={onViewMapFor ? () => onViewMapFor(block) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

export function CampSchedule({
  teams,
  remindersOn,
  onRemindersChange,
  focusDayId,
  focusBlockId,
  focusGroup,
  scrollNonce,
  onScheduleFocusConsumed,
  onViewLocation,
}: Props) {
  const [dayId, setDayId] = useState("day-1");
  const [allowDemo, setAllowDemo] = useState(false);
  const [track, setTrack] = useState<TrackFilter>("overview");
  const [myTeamId, setMyTeamId] = useState<number | "">("");
  const [teamSnapshot, setTeamSnapshot] = useState<MyTeamSnapshot | null>(null);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [localScrollNonce, setLocalScrollNonce] = useState(0);
  const [demoEpoch, setDemoEpoch] = useState(0);
  const teamTrackReady = useRef(false);
  const pendingScroll = useRef<{
    blockId: string;
    token: number;
  } | null>(null);
  const consumedRef = useRef(onScheduleFocusConsumed);
  consumedRef.current = onScheduleFocusConsumed;

  useEffect(() => {
    const snap = readMyTeamSnapshot();
    if (!snap) return;
    setMyTeamId(snap.teamId);
    setTeamSnapshot(snap);
  }, []);

  useEffect(() => {
    setDemoScheduleEnabled(true);
    setAllowDemo(process.env.NODE_ENV === "development");
    const days = getScheduleDays(new Date(), true);
    if (days[0]?.id === DEMO_DAY_ID) setDayId(DEMO_DAY_ID);
  }, []);

  // Keep localStorage snapshot in sync when live standings include the team.
  useEffect(() => {
    if (myTeamId === "") return;
    const live = teams.find((t) => t.id === myTeamId);
    if (!live) return;
    const next: MyTeamSnapshot = {
      teamId: live.id,
      campGroup: live.campGroup,
      teamName: live.name,
    };
    setTeamSnapshot(next);
    writeMyTeamSnapshot(next);
  }, [teams, myTeamId]);

  const myTeam = useMemo(() => {
    const live = teams.find((t) => t.id === myTeamId);
    if (live) return live;
    // Offline / empty roster: synthesize from last saved snapshot
    if (
      teamSnapshot &&
      myTeamId !== "" &&
      teamSnapshot.teamId === myTeamId &&
      (teamSnapshot.campGroup === "red" || teamSnapshot.campGroup === "green")
    ) {
      return {
        id: teamSnapshot.teamId,
        name: teamSnapshot.teamName ?? `Team ${teamSnapshot.teamId}`,
        color: "#888888",
        score: 0,
        rank: 0,
        campGroup: teamSnapshot.campGroup,
      } satisfies StandingRow;
    }
    return null;
  }, [teams, myTeamId, teamSnapshot]);

  // Apply saved team's track once when teams load — never override map navigation
  useEffect(() => {
    if (teamTrackReady.current) return;
    if (!myTeam?.campGroup) return;
    // Map navigation owns track for this visit; mark ready so we don't
    // flip back to the team color after focus is consumed.
    if (scrollNonce) {
      teamTrackReady.current = true;
      return;
    }
    setTrack(myTeam.campGroup);
    teamTrackReady.current = true;
  }, [myTeam?.campGroup, scrollNonce]);

  // One-shot navigation from map
  useEffect(() => {
    if (!scrollNonce || !focusBlockId) return;
    const token = scrollNonce;
    if (focusDayId) setDayId(focusDayId);
    if (focusGroup === "red" || focusGroup === "green") {
      setTrack(focusGroup);
    } else {
      setTrack("overview");
    }
    teamTrackReady.current = true;
    setHighlightId(focusBlockId);
    pendingScroll.current = { blockId: focusBlockId, token };
    setLocalScrollNonce(token);
  }, [scrollNonce, focusBlockId, focusDayId, focusGroup]);

  // Scroll only when localScrollNonce changes (map click or Jump) — not on
  // manual day/track tab changes.
  useEffect(() => {
    if (!localScrollNonce) return;
    const pending = pendingScroll.current;
    if (!pending || pending.token !== localScrollNonce) return;

    const timer = window.setTimeout(() => {
      if (pendingScroll.current?.token !== pending.token) return;
      document
        .getElementById(`schedule-block-${pending.blockId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      pendingScroll.current = null;
      consumedRef.current?.();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [localScrollNonce]);

  useEffect(() => {
    let id = 0;
    const start = () => {
      setNowTick(Date.now());
      window.clearInterval(id);
      id = window.setInterval(() => setNowTick(Date.now()), 1000);
    };
    const stop = () => window.clearInterval(id);
    const onVis = () => {
      if (document.hidden) stop();
      else start();
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  function selectTeam(id: number | "") {
    cancelPendingScroll();
    setMyTeamId(id);
    setHighlightId(null);
    if (id === "") {
      writeMyTeamSnapshot(null);
      setTeamSnapshot(null);
      setTrack("overview");
      teamTrackReady.current = true;
      return;
    }
    const team = teams.find((t) => t.id === id);
    const next: MyTeamSnapshot = {
      teamId: id,
      campGroup: team?.campGroup ?? teamSnapshot?.campGroup ?? null,
      teamName: team?.name ?? teamSnapshot?.teamName,
    };
    setTeamSnapshot(next);
    writeMyTeamSnapshot(next);
    if (next.campGroup === "red" || next.campGroup === "green") {
      setTrack(next.campGroup);
    }
    teamTrackReady.current = true;
  }

  function cancelPendingScroll() {
    pendingScroll.current = null;
  }

  function jumpToBlock(
    targetDayId: string,
    targetBlockId: string,
    group: "all" | "red" | "green",
  ) {
    setDayId(targetDayId);
    if (group === "red" || group === "green") setTrack(group);
    else if (myTeam?.campGroup) setTrack(myTeam.campGroup);
    else setTrack("overview");
    setHighlightId(targetBlockId);
    const token = Date.now();
    pendingScroll.current = { blockId: targetBlockId, token };
    setLocalScrollNonce(token);
  }

  const calendarKey = isoDateKey(new Date(nowTick));
  const days = useMemo(
    () => getScheduleDays(new Date(), allowDemo),
    [allowDemo, demoEpoch, calendarKey],
  );
  const day = useMemo(() => {
    return days.find((d) => d.id === dayId) ?? days[0]!;
  }, [days, dayId]);
  const todayDay = findCampDayForDate(new Date(nowTick), days);
  const clock = new Date(nowTick);
  const isSplit = day.mode === "split";
  const viewingEveryone = !isSplit || track === "overview";
  const activeTrack: ScheduleTrack = viewingEveryone
    ? "overview"
    : track === "red" || track === "green"
      ? track
      : "overview";
  const showGroupedNowNext = isSplit && track === "overview";

  const liveEvents = useMemo(
    () => findLiveEvents(activeTrack, clock, days),
    // clock is derived from nowTick; days is stable for the session
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTrack, nowTick, days],
  );

  const upcomingLanes = useMemo((): UpcomingLane[] => {
    if (showGroupedNowNext) {
      return [
        { track: "all", result: findUpcomingEvent("all", clock, days) },
        { track: "red", result: findUpcomingExclusive("red", clock, days) },
        { track: "green", result: findUpcomingExclusive("green", clock, days) },
      ];
    }
    const laneTrack =
      activeTrack === "red" || activeTrack === "green" ? activeTrack : "all";
    return [
      { track: laneTrack, result: findUpcomingEvent(activeTrack, clock, days) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGroupedNowNext, activeTrack, nowTick, days]);

  const chrome: "all" | "red" | "green" =
    track === "red" || track === "green" ? track : "all";
  const morning = day.blocks.filter(
    (b) => b.section === "morning" && b.group === "all",
  );
  const evening = day.blocks.filter(
    (b) => b.section === "evening" && b.group === "all",
  );
  const fullDay = day.blocks.filter((b) => b.section === "full");
  const redBlocks = day.blocks.filter((b) => b.group === "red");
  const greenBlocks = day.blocks.filter((b) => b.group === "green");
  const dayActiveClass =
    chrome === "green"
      ? "bg-[#2F8F4E] text-on-strong shadow-sm"
      : chrome === "red"
        ? "bg-[#C45C26] text-on-strong shadow-sm"
        : "bg-woody text-on-strong shadow-sm";

  function handleViewMap(block: ScheduleBlock) {
    setMapNotice(null);
    const ids = block.locationIds ?? [];
    const mappedId = firstMappedLocationId(ids);
    if (mappedId) {
      const loc = getLocation(mappedId)!;
      onViewLocation?.({
        locationId: mappedId,
        mapped: true,
        floorId: loc.floorId,
        roomId: loc.roomId,
        label: loc.label,
      });
      return;
    }

    const firstId = ids[0];
    const loc = firstId ? getLocation(firstId) : undefined;
    const label = loc?.label ?? block.location ?? "this location";
    setMapNotice(
      `No map for ${label} yet — add a floor/map for this location.`,
    );
    onViewLocation?.({
      locationId: firstId ?? "unknown",
      mapped: false,
      label,
    });
  }

  return (
    <section className="panel toy-box relative overflow-hidden rounded-3xl p-3 sm:p-5 md:p-6">
      <div>
        <p className="display-font text-xs font-semibold uppercase tracking-[0.22em] text-muted-soft">
          Camp itinerary
        </p>
        <h2 className="display-font text-2xl font-bold text-ink sm:text-3xl">
          Schedule
        </h2>
        <p className="mt-1 text-sm font-semibold text-muted">
          {day.dateLabel}
          {!isSplit ? " · Everyone together" : ""}
          {todayDay ? ` · Today is ${todayDay.label}` : ""}
        </p>
      </div>

      {day.id === DEMO_DAY_ID ? (
        <div className="mt-3 rounded-2xl border-2 border-woody/40 bg-chip/80 px-4 py-3">
          <p className="text-sm font-bold text-woody">
            Test day — overlapping Red/Green events, timers, faded Done cards,
            and reminder popups. Hidden once camp starts. Local only.
          </p>
          <button
            type="button"
            className="btn-soft mt-2 rounded-xl border px-3 py-1.5 text-xs font-extrabold"
            onClick={() => {
              resetDemoScheduleClock();
              clearRemindersForDay(DEMO_DAY_ID);
              setDemoEpoch((n) => n + 1);
              setNowTick(Date.now());
            }}
          >
            Restart test events
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        <label className="block text-sm font-bold text-muted">
          My team
          <select
            value={myTeamId}
            onChange={(e) =>
              selectTeam(e.target.value ? Number(e.target.value) : "")
            }
            className="field mt-1.5 w-full rounded-xl border-2 px-3 py-3 text-base font-semibold"
          >
            <option value="">Everyone — see all groups</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.campGroup ? ` (${t.campGroup})` : " (no group yet)"}
              </option>
            ))}
            {teamSnapshot &&
            myTeamId !== "" &&
            !teams.some((t) => t.id === teamSnapshot.teamId) ? (
              <option value={teamSnapshot.teamId}>
                {teamSnapshot.teamName ?? `Team ${teamSnapshot.teamId}`}
                {teamSnapshot.campGroup
                  ? ` (${teamSnapshot.campGroup}, saved offline)`
                  : " (saved offline)"}
              </option>
            ) : null}
          </select>
        </label>

        {myTeam?.campGroup === "red" || myTeam?.campGroup === "green" ? (
          <div
            className={`mt-3 overflow-hidden rounded-2xl border-2 px-4 py-3.5 text-white shadow-sm sm:px-5 sm:py-4 ${
              myTeam.campGroup === "green"
                ? "border-[#246B3A] bg-[#2F8F4E]"
                : "border-[#9A451C] bg-[#C45C26]"
            }`}
            role="status"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/80">
              Follow this schedule
            </p>
            <p className="display-font mt-1 text-2xl font-bold leading-tight sm:text-3xl">
              {myTeam.campGroup === "green" ? "GREEN" : "RED"} group
            </p>
            <p className="mt-1 text-sm font-bold text-white/90">
              {myTeam.name} uses the{" "}
              <span className="underline decoration-2 underline-offset-2">
                {myTeam.campGroup === "green" ? "Green" : "Red"}
              </span>{" "}
              schedule all weekend — ignore the other color.
            </p>
          </div>
        ) : myTeamId ? (
          <p className="mt-3 rounded-2xl border-2 border-woody/30 bg-chip/80 px-4 py-3 text-sm font-bold text-woody">
            This team is not assigned to Red or Green yet — ask an admin to set
            its camp group.
          </p>
        ) : null}
      </div>

      <div className="surface-card mt-4 rounded-2xl border-2 p-4">
        <NowNextBoard
          now={clock}
          live={liveEvents}
          upcoming={upcomingLanes}
          grouped={showGroupedNowNext}
          onJump={jumpToBlock}
        />
        <p className="mt-3 text-[11px] font-semibold text-muted-soft">
          As of {clock.toLocaleString()} · {isoDateKey(clock)}
        </p>

        {onRemindersChange ? (
          <RemindMeToggle
            enabled={Boolean(remindersOn)}
            onChange={onRemindersChange}
            trackLabel={
              myTeam?.campGroup === "red"
                ? "Red group"
                : myTeam?.campGroup === "green"
                  ? "Green group"
                  : "Everyone, Red, and Green"
            }
          />
        ) : null}
      </div>

      {mapNotice ? (
        <p className="mt-3 rounded-2xl border-2 border-woody/40 bg-chip/80 px-4 py-3 text-sm font-bold text-woody">
          {mapNotice}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {days.map((d) => {
          const active = d.id === dayId;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                cancelPendingScroll();
                setDayId(d.id);
                setHighlightId(null);
              }}
              className={`rounded-xl px-3.5 py-2 text-sm font-extrabold transition ${
                active
                  ? dayActiveClass
                  : "border border-saddle/20 bg-card text-card-ink"
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      {isSplit ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["overview", "Everyone"],
              ["red", "Red group"],
              ["green", "Green group"],
            ] as const
          ).map(([id, label]) => {
            const active = track === id;
            const color =
              id === "red"
                ? active
                  ? "bg-[#C45C26] text-on-strong"
                  : "border-[#C45C26]/40 text-[#C45C26] bg-card"
                : id === "green"
                  ? active
                    ? "bg-[#2F8F4E] text-on-strong"
                    : "border-[#2F8F4E]/40 text-[#2F8F4E] bg-card"
                  : active
                    ? "bg-[#1E6BB8] text-on-strong"
                    : "border-saddle/20 text-card-ink bg-card";
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  cancelPendingScroll();
                  setTrack(id);
                  setHighlightId(null);
                }}
                className={`rounded-xl border px-3.5 py-2 text-sm font-extrabold transition ${color}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={`${day.id}-${track}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="mt-5 space-y-6"
        >
          {!isSplit ? (
            <Section
              title="Full day — Everyone together"
              tint="all"
              chrome={chrome}
              day={day}
              now={new Date(nowTick)}
              blocks={fullDay}
              highlightBlockId={highlightId}
              onViewMapFor={handleViewMap}
            />
          ) : (
            <>
              <Section
                title="Morning — Everyone together"
                tint="all"
                chrome={chrome}
                day={day}
              now={new Date(nowTick)}
              blocks={morning}
                highlightBlockId={highlightId}
                onViewMapFor={handleViewMap}
              />

              {track === "overview" ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  <Section
                    title="Red group"
                    tint="red"
                    chrome="red"
                    day={day}
              now={new Date(nowTick)}
              blocks={redBlocks}
                    cabins={redCabins}
                    highlightBlockId={highlightId}
                    onViewMapFor={handleViewMap}
                  />
                  <Section
                    title="Green group"
                    tint="green"
                    chrome="green"
                    day={day}
              now={new Date(nowTick)}
              blocks={greenBlocks}
                    cabins={greenCabins}
                    highlightBlockId={highlightId}
                    onViewMapFor={handleViewMap}
                  />
                </div>
              ) : null}

              {track === "red" ? (
                <Section
                  title="Red group"
                  tint="red"
                  chrome={chrome}
                  day={day}
              now={new Date(nowTick)}
              blocks={redBlocks}
                  cabins={redCabins}
                  highlightBlockId={highlightId}
                  onViewMapFor={handleViewMap}
                />
              ) : null}

              {track === "green" ? (
                <Section
                  title="Green group"
                  tint="green"
                  chrome={chrome}
                  day={day}
              now={new Date(nowTick)}
              blocks={greenBlocks}
                  cabins={greenCabins}
                  highlightBlockId={highlightId}
                  onViewMapFor={handleViewMap}
                />
              ) : null}

              <Section
                title="Evening — Everyone together"
                tint="all"
                chrome={chrome}
                day={day}
              now={new Date(nowTick)}
              blocks={evening}
                highlightBlockId={highlightId}
                onViewMapFor={handleViewMap}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
