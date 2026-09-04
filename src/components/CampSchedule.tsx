"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getLocation, mappedLocations, offMapNoteFor } from "@/data/locations";
import {
  campDays,
  greenCabins,
  redCabins,
  type CampDay,
  type ScheduleBlock,
} from "@/data/schedule";
import {
  blockVisibleToCabin,
  detailsForCabin,
  CAMP_PAPER,
  cabinLabel,
  campCabins,
  getCabin,
  inkOn,
  scrimOn,
} from "@/lib/cabins";
import { expandRotationForCabin } from "@/lib/rotations";
import {
  clearRemindersForDay,
} from "@/lib/event-reminders";
import {
  DEMO_DAY_ID,
  getScheduleDays,
  resetDemoScheduleClock,
  setDemoScheduleEnabled,
} from "@/lib/schedule-demo";
import { LIVE_CAMP_SIM, resetLiveSimClock } from "@/lib/schedule-sim";
import {
  readMyTeamSnapshot,
  setMyBracelet,
  type MyTeamSnapshot,
} from "@/lib/offline";
import {
  blockStatus,
  eventCountdown,
  findLiveEvents,
  findUpcomingEvent,
  findUpcomingExclusive,
  firstOpenDay,
  dayIsComplete,
  formatCountdown,
  isoDateKey,
  type BlockStatus,
  type ScheduleTrack,
} from "@/lib/schedule-time";
import { springSnappy } from "@/lib/motion";
import { scrollToTarget } from "@/lib/scroll";
import { NowNextBoard, type UpcomingLane } from "./NowNextBoard";
import { RemindMeToggle } from "./RemindMeToggle";

type TrackFilter = "overview" | "red" | "green";

type Props = {
  /**
   * False while the camper is on another tab. The panel stays mounted so the
   * chosen day and track survive a trip to the map, but a hidden schedule must
   * not keep a 1s clock re-rendering ~60 cards behind display:none.
   */
  active?: boolean;
  /** 15-minutes-before reminder opt-in, owned by the board */
  remindersOn?: boolean;
  onRemindersChange?: (on: boolean) => void;
  /** Fired when the camper picks a cabin — announce what's live for that cabin */
  onTeamSwitch?: (
    group: "overview" | "red" | "green",
    cabinId?: number | null,
  ) => void;
  focusDayId?: string | null;
  focusBlockId?: string | null;
  focusGroup?: "all" | "red" | "green" | null;
  /** Map room this event was opened from — View on map should return here */
  focusFloorId?: string | null;
  focusRoomId?: string | null;
  /** Only set when navigating from the map (or similar) — triggers one scroll */
  scrollNonce?: number | null;
  onScheduleFocusConsumed?: () => void;
  onViewLocation?: (payload: {
    locationId: string;
    mapped: boolean;
    floorId?: string;
    roomId?: string;
    label: string;
    blockId?: string;
  }) => void;
};

function chromeClasses(chrome: "all" | "red" | "green") {
  if (chrome === "green") {
    return {
      cardBorder: "border-[#2F8F4E]/55 border-l-[#2F8F4E]",
      time: "text-[#2F8F4E]",
    };
  }
  if (chrome === "red") {
    return {
      cardBorder: "border-[#C45C26]/55 border-l-[#C45C26]",
      time: "text-[#C45C26]",
    };
  }
  return {
    cardBorder: "border-[#1E6BB8]/50 border-l-[#1E6BB8]",
    time: "text-[#1E6BB8]",
  };
}

function BlockCard({
  block,
  accent,
  paint,
  highlighted,
  status = "untimed",
  endsInMs,
  onViewMap,
  mapSpots,
}: {
  block: ScheduleBlock;
  accent: "all" | "red" | "green";
  paint?: string;
  highlighted?: boolean;
  status?: BlockStatus;
  endsInMs?: number | null;
  onViewMap?: (locationId?: string) => void;
  mapSpots?: { id: string; label: string }[];
}) {
  // Color by the event's own group — Everyone stays blue even on Red/Green, so
  // a shared event still reads as shared. The camper's own events take their
  // bracelet colour when there is one.
  const colors = chromeClasses(accent);
  const own = accent !== "all" && paint;
  const cardStyle = own
    ? { borderColor: `${paint}8c`, borderLeftColor: paint }
    : undefined;
  const timeStyle = own ? { color: paint } : undefined;
  // Where an event happens when none of its locations are on a map.
  const offMapNote = offMapNoteFor(block.locationIds);
  const done = status === "done";
  const live = status === "live";

  return (
    // No `layout` here: the clock ticks once a second, and a layout animation
    // would re-measure every card in the day on each of those renders. The
    // highlight reads from the ring below instead of a scale keyframe.
    <motion.article
      id={`schedule-block-${block.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSnappy}
      style={done ? undefined : cardStyle}
      className={`relative overflow-hidden rounded-2xl border border-l-4 p-3.5 text-card-ink shadow-sm sm:p-4 ${
        done
          ? "schedule-done border-[#8a8178]/40 border-l-[#8a8178] bg-[#ebe4da] dark:bg-card"
          : `bg-card ${own ? "" : colors.cardBorder}`
      } ${
        highlighted && !done
          ? `bg-laser/15 ring-2 ring-laser ring-offset-2 ring-offset-transparent`
          : ""
      } ${live ? "ring-2 ring-laser/70" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {block.time ? (
            <p
              style={done ? undefined : timeStyle}
              className={`text-xs font-extrabold uppercase tracking-wide sm:text-sm ${
                done
                  ? "text-muted-soft line-through"
                  : own
                    ? ""
                    : colors.time
              }`}
            >
              {block.time}
            </p>
          ) : null}
          <h4
            className={`display-font mt-0.5 text-base font-bold sm:text-lg ${
              done ? "text-muted line-through decoration-2" : "text-card-ink"
            }`}
          >
            {block.title}
          </h4>
        </div>
        <AnimatePresence>
          {done ? (
            <motion.span
              key="done"
              initial={{ scale: 1.7, rotate: -22, opacity: 0, x: 12 }}
              animate={{ scale: 1, rotate: -8, opacity: 1, x: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={springSnappy}
              className="shrink-0 rounded-full bg-[#6b7280] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-md"
            >
              ✓ Done
            </motion.span>
          ) : null}
        </AnimatePresence>
        {live ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-md">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
            Live
          </span>
        ) : null}
      </div>
      {live && endsInMs != null ? (
        <p className="mt-1 flex items-center gap-2 text-sm font-extrabold text-red-600">
          Ends in
          <span className="countdown">{formatCountdown(endsInMs)}</span>
        </p>
      ) : null}
      {block.location ? (
        <p
          style={done ? undefined : timeStyle}
          className={`mt-1 text-sm font-bold ${
            done ? "text-muted-soft" : own ? "" : colors.time
          }`}
        >
          <span className="text-muted-soft">Location · </span>
          {block.location}
        </p>
      ) : null}
      {block.note ? (
        <p className="mt-1 text-sm font-semibold text-muted-soft">{block.note}</p>
      ) : null}
      {/* A button only appears when the map can actually take you somewhere.
          "On the go", "Open", the buses and the B4 building are either not
          places at all or buildings we have no plan for, and a button there
          used to open the map on whatever room the id happened to point at.
          Those now read as a note saying where the thing actually happens. */}
      {onViewMap && mapSpots && mapSpots.length > 0 ? (
        <div className="relative z-10 mt-3 flex flex-wrap gap-2">
          {mapSpots.length > 1 ? (
            mapSpots.map((spot) => (
              <button
                key={spot.id}
                type="button"
                onClick={() => onViewMap(spot.id)}
                className="btn-cta min-h-11 cursor-pointer rounded-xl bg-star px-3 py-2.5 text-xs font-extrabold"
              >
                See {spot.label} on the map →
              </button>
            ))
          ) : (
            <button
              type="button"
              onClick={() => onViewMap(mapSpots[0].id)}
              className="btn-cta min-h-11 cursor-pointer rounded-xl bg-star px-3 py-2.5 text-xs font-extrabold"
            >
              See where this is on the map →
            </button>
          )}
        </div>
      ) : offMapNote ? (
        <p className="mt-3 flex items-start gap-1.5 text-xs font-bold text-muted-soft">
          <span aria-hidden>📍</span>
          <span>{offMapNote}</span>
        </p>
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
    </motion.article>
  );
}

function shortMapLabel(label: string) {
  return label
    .replace(/^B1-B\s+/i, "")
    .replace(/^B1\s+—\s+/i, "")
    .replace(/^B4-B\s+/i, "")
    .replace(/^B4\s+—\s+/i, "");
}

function Section({
  title,
  tint,
  day,
  now,
  blocks,
  cabins,
  paint,
  highlightBlockId,
  onViewMapFor,
}: {
  title: string;
  tint: "all" | "red" | "green";
  /** The camper's bracelet colour, when this heading is their own track. */
  paint?: string;
  day: CampDay;
  now: Date;
  blocks: ScheduleBlock[];
  cabins?: string[];
  highlightBlockId?: string | null;
  onViewMapFor?: (block: ScheduleBlock, locationId?: string) => void;
}) {
  if (blocks.length === 0) return null;

  const headerBg =
    tint === "red"
      ? "bg-[#C45C26] text-on-strong"
      : tint === "green"
        ? "bg-[#2F8F4E] text-on-strong"
        : "bg-[#1E6BB8] text-on-strong";

  // `paint` is the camper's bracelet. When it is set the heading wears that
  // colour instead of the track's, so the list matches the banner above it.
  const painted = paint
    ? { backgroundColor: paint, color: inkOn(paint) }
    : undefined;

  return (
    <div className="space-y-3">
      <div
        className={`rounded-2xl px-3.5 py-2.5 ${paint ? "" : headerBg}`}
        style={painted}
      >
        <h3
          className={`display-font text-lg font-bold sm:text-xl ${paint ? "" : "text-on-strong"}`}
        >
          {title}
        </h3>
        {cabins?.length ? (
          <p
            className={`mt-1 text-xs font-semibold sm:text-sm ${paint ? "opacity-90" : "text-on-strong/90"}`}
          >
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
              paint={paint}
              status={status}
              endsInMs={count?.endsIn}
              highlighted={highlightBlockId === block.id}
              mapSpots={mappedLocations(block.locationIds).map((loc) => ({
                id: loc.id,
                label: shortMapLabel(loc.label),
              }))}
              onViewMap={
                onViewMapFor
                  ? (locationId) => onViewMapFor(block, locationId)
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

export function CampSchedule({
  active = true,
  remindersOn,
  onRemindersChange,
  onTeamSwitch,
  focusDayId,
  focusBlockId,
  focusGroup,
  focusFloorId,
  focusRoomId,
  scrollNonce,
  onScheduleFocusConsumed,
  onViewLocation,
}: Props) {
  const [dayId, setDayId] = useState("day-1");
  const [allowDemo, setAllowDemo] = useState(false);
  const [track, setTrack] = useState<TrackFilter>("overview");
  const [peekFullGroup, setPeekFullGroup] = useState(false);
  const [teamSnapshot, setTeamSnapshot] = useState<MyTeamSnapshot | null>(null);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [preferredMap, setPreferredMap] = useState<{
    blockId: string;
    floorId: string;
    roomId: string;
  } | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [localScrollNonce, setLocalScrollNonce] = useState(0);
  const [demoEpoch, setDemoEpoch] = useState(0);
  const [simReady, setSimReady] = useState(!LIVE_CAMP_SIM);
  const teamTrackReady = useRef(false);
  const followLiveDay = useRef(true);
  const openDayIdRef = useRef<string | null>(null);
  const pendingScroll = useRef<{
    blockId: string;
    token: number;
  } | null>(null);
  const consumedRef = useRef(onScheduleFocusConsumed);
  consumedRef.current = onScheduleFocusConsumed;

  useEffect(() => {
    const snap = readMyTeamSnapshot();
    if (!snap) return;
    setTeamSnapshot(snap);
  }, []);

  useEffect(() => {
    setDemoScheduleEnabled(true);
    setAllowDemo(process.env.NODE_ENV === "development");
    setSimReady(true);
    const days = getScheduleDays(new Date(), true);
    if (days[0]?.id === DEMO_DAY_ID) setDayId(DEMO_DAY_ID);
  }, []);

  /**
   * Who this camper is, as far as the schedule is concerned: a bracelet, and
   * the track that bracelet belongs to.
   *
   * This used to be a row from the standings, looked up by team id and
   * synthesized from the snapshot when the roster had not loaded. A team said
   * nothing about the schedule that the cabin did not already say, so the
   * identity is read straight from the saved bracelet instead — which needs no
   * roster, and so is right on the first paint and right offline.
   */
  const myTeam = useMemo(() => {
    const cabin = getCabin(teamSnapshot?.cabinId);
    if (!cabin) return null;
    return { campGroup: cabin.group, cabinId: cabin.id };
  }, [teamSnapshot?.cabinId]);

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
    followLiveDay.current = !focusDayId || focusDayId === openDayIdRef.current;
    if (focusFloorId && focusRoomId) {
      setPreferredMap({
        blockId: focusBlockId,
        floorId: focusFloorId,
        roomId: focusRoomId,
      });
    }
  }, [scrollNonce, focusBlockId, focusDayId, focusGroup, focusFloorId, focusRoomId]);

  // Scroll only when localScrollNonce changes (map click or Jump) — not on
  // manual day/track tab changes.
  useEffect(() => {
    if (!localScrollNonce) return;
    const pending = pendingScroll.current;
    if (!pending || pending.token !== localScrollNonce) return;

    const timer = window.setTimeout(() => {
      if (pendingScroll.current?.token !== pending.token) return;
      scrollToTarget(
        document.getElementById(`schedule-block-${pending.blockId}`),
      );
      pendingScroll.current = null;
      consumedRef.current?.();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [localScrollNonce]);

  // Gated on `active` as well as document visibility: the schedule stays
  // mounted behind display:none so the camper's day and track survive a trip
  // to the map, and a ticking clock there would re-render every card for
  // nothing. Re-entering restarts the clock and resyncs immediately, so no
  // countdown is ever stale on arrival.
  useEffect(() => {
    if (!active) return;
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
  }, [active]);

  /**
   * Picking a bracelet is the whole choice now.
   *
   * The schedule needs a cabin and the track it belongs to; the team was a step
   * in between that told a camper nothing they did not already know from the
   * band on their wrist. The saved snapshot carries no team id, and everything
   * downstream — the filtering here, the reminders on the board — reads the
   * cabin and group from it exactly as before.
   */
  function selectBracelet(cabinId: number | null) {
    cancelPendingScroll();
    setHighlightId(null);
    setPeekFullGroup(false);
    setBracelet(cabinId);
    if (cabinId == null) {
      // Through the helper, because the standings own the other half of this
      // record — clearing the bracelet must not disown the team.
      setMyBracelet(null);
      setTeamSnapshot(readMyTeamSnapshot());
      setTrack("overview");
      teamTrackReady.current = true;
      return;
    }
    const cabin = getCabin(cabinId);
    if (!cabin) return;
    setMyBracelet({ id: cabin.id, group: cabin.group });
    setTeamSnapshot(readMyTeamSnapshot());
    setTrack(cabin.group);
    teamTrackReady.current = true;
    onTeamSwitch?.(cabin.group, cabin.id);
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
    followLiveDay.current = targetDayId === openDayIdRef.current;
  }

  const calendarKey = isoDateKey(new Date(nowTick));
  const days = useMemo(() => {
    void demoEpoch;
    if (LIVE_CAMP_SIM && !simReady) return campDays;
    return getScheduleDays(new Date(), allowDemo);
  }, [allowDemo, calendarKey, demoEpoch, simReady]);
  // Which bracelet colour is open in the picker. Follows the chosen team, so
  // reopening the schedule shows the colour that camper already belongs to.
  const [bracelet, setBracelet] = useState<number | "none" | null>(null);

  const activeCabinId =
    typeof myTeam?.cabinId === "number"
      ? myTeam.cabinId
      : typeof teamSnapshot?.cabinId === "number"
        ? teamSnapshot.cabinId
        : null;
  useEffect(() => {
    if (activeCabinId != null) setBracelet(activeCabinId);
  }, [activeCabinId]);

  const filterCabinId =
    !peekFullGroup &&
    activeCabinId != null &&
    myTeam?.campGroup != null &&
    track === myTeam.campGroup
      ? activeCabinId
      : null;
  const daysForYou = useMemo(
    () =>
      days.map((d) => ({
        ...d,
        blocks: d.blocks
          .filter((b) => blockVisibleToCabin(b, filterCabinId))
          // Rotations become one event per round before anything else looks
          // at them, so a card, a map button and a reminder all describe the
          // same single activity in a single place.
          .flatMap((b) => expandRotationForCabin(b, filterCabinId))
          .map((b) => ({ ...b, details: detailsForCabin(b, filterCabinId) })),
      })),
    [days, filterCabinId],
  );
  const day = useMemo(() => {
    return daysForYou.find((d) => d.id === dayId) ?? daysForYou[0]!;
  }, [daysForYou, dayId]);
  const clock = new Date(nowTick);
  const isSplit = day.mode === "split";
  const viewingEveryone = !isSplit || track === "overview";
  const activeTrack: ScheduleTrack = viewingEveryone
    ? "overview"
    : track === "red" || track === "green"
      ? track
      : "overview";
  const progressTrack: ScheduleTrack =
    myTeam?.campGroup === "red" || myTeam?.campGroup === "green"
      ? myTeam.campGroup
      : activeTrack;
  const openDay = firstOpenDay(daysForYou, clock, progressTrack);
  openDayIdRef.current = openDay?.id ?? null;

  useEffect(() => {
    if (!openDay || !followLiveDay.current) return;
    if (dayId === openDay.id) return;
    const viewing = daysForYou.find((d) => d.id === dayId);
    if (!viewing) {
      setDayId(openDay.id);
      return;
    }
    if (!dayIsComplete(viewing, clock, progressTrack)) return;
    const index = daysForYou.findIndex((d) => d.id === dayId);
    const next = daysForYou[index + 1];
    if (next) setDayId(next.id);
  }, [clock, dayId, daysForYou, openDay, progressTrack]);
  /**
   * A camper who has picked a team is locked to that team's track. Before this
   * they could sit on "Everyone" and see both colours side by side, and the
   * "Coming up next" board showed three lanes — Everyone, Red and Green — so
   * two thirds of what it told them belonged to somebody else's group.
   */
  const lockedGroup =
    myTeam?.campGroup === "red" || myTeam?.campGroup === "green"
      ? myTeam.campGroup
      : null;
  const showGroupedNowNext = isSplit && track === "overview" && !lockedGroup;

  useEffect(() => {
    if (lockedGroup && track !== lockedGroup) setTrack(lockedGroup);
  }, [lockedGroup, track]);

  const liveEvents = useMemo(
    () => findLiveEvents(activeTrack, clock, daysForYou),
    // clock is derived from nowTick; days is stable for the session
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTrack, nowTick, daysForYou],
  );

  const upcomingLanes = useMemo((): UpcomingLane[] => {
    if (showGroupedNowNext) {
      return [
        { track: "all", result: findUpcomingEvent("all", clock, daysForYou) },
        { track: "red", result: findUpcomingExclusive("red", clock, daysForYou) },
        { track: "green", result: findUpcomingExclusive("green", clock, daysForYou) },
      ];
    }
    const laneTrack =
      activeTrack === "red" || activeTrack === "green" ? activeTrack : "all";
    return [
      { track: laneTrack, result: findUpcomingEvent(activeTrack, clock, daysForYou) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGroupedNowNext, activeTrack, nowTick, daysForYou]);

  const morning = day.blocks.filter(
    (b) => b.section === "morning" && b.group === "all",
  );
  const evening = day.blocks.filter(
    (b) => b.section === "evening" && b.group === "all",
  );
  const fullDay = day.blocks.filter((b) => b.section === "full");
  const redBlocks = day.blocks.filter((b) => b.group === "red");
  const greenBlocks = day.blocks.filter((b) => b.group === "green");
  // The chosen day used to take the group's colour, which put a second,
  // competing identity on screen next to the bracelet. It uses the board's own
  // highlight now, the same one every other selected control uses.
  // The camper's own track wears their bracelet; anyone browsing without a
  // team still sees the plain group headings.
  const myBracelet = activeCabinId ? getCabin(activeCabinId) : null;
  const headingFor = (g: "red" | "green") =>
    lockedGroup === g && myBracelet
      ? `${myBracelet.name} bracelet`
      : g === "red"
        ? "Red group"
        : "Green group";
  const paintFor = (g: "red" | "green") =>
    lockedGroup === g && myBracelet ? myBracelet.swatch : undefined;

  const dayActiveClass = "bg-star text-on-star shadow-sm";

  function handleViewMap(block: ScheduleBlock, locationId?: string) {
    setMapNotice(null);
    const ids = block.locationIds ?? [];
    const spots = mappedLocations(ids);
    const chosen =
      (locationId ? spots.find((loc) => loc.id === locationId) : undefined) ??
      (preferredMap?.blockId === block.id
        ? spots.find(
            (loc) =>
              loc.floorId === preferredMap.floorId &&
              loc.roomId === preferredMap.roomId,
          )
        : undefined) ??
      spots[0];

    if (chosen) {
      onViewLocation?.({
        locationId: chosen.id,
        mapped: true,
        floorId: chosen.floorId,
        roomId: chosen.roomId,
        label: chosen.label,
        blockId: block.id,
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
        </p>
      </div>

      {LIVE_CAMP_SIM ? (
        <div className="mt-3 rounded-2xl border-2 border-star/40 bg-chip/80 px-4 py-3">
          <p className="text-sm font-bold text-star">
            Simulation preview — the real 3-day camp, shifted so Arrival starts
            when you opened this page (or when you tap Restart from now). Not the
            public site. Gaps and lengths stay the same.
          </p>
          <button
            type="button"
            className="btn-soft mt-2 min-h-11 rounded-xl border px-3 py-1.5 text-xs font-extrabold"
            onClick={() => {
              resetLiveSimClock();
              for (const d of days) clearRemindersForDay(d.id);
              setDemoEpoch((n) => n + 1);
              setNowTick(Date.now());
              followLiveDay.current = true;
              setDayId("day-1");
            }}
          >
            Restart from now
          </button>
        </div>
      ) : day.id === DEMO_DAY_ID ? (
        <div className="mt-3 rounded-2xl border-2 border-star/40 bg-chip/80 px-4 py-3">
          <p className="text-sm font-bold text-star">
            Test day — overlapping Red/Green events, timers, faded Done cards,
            and reminder popups. Hidden once camp starts. Local only.
          </p>
          <button
            type="button"
            className="btn-soft mt-2 min-h-11 rounded-xl border px-3 py-1.5 text-xs font-extrabold"
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
        <p className="text-sm font-bold text-muted">My bracelet</p>
        <p className="mt-0.5 text-xs font-semibold text-muted-soft">
          Tap the colour of your bracelet.
        </p>

        {/* Colours, not a dropdown. A native select can only render text, so
            the bracelet was named but never shown — which is no use to a child
            matching a band on their wrist to the screen. */}
        <div className="mt-2 flex flex-wrap gap-2">
          {campCabins.map((cabin) => {
            const open = bracelet === cabin.id;
            return (
              <button
                key={cabin.id}
                type="button"
                aria-pressed={open}
                onClick={() => selectBracelet(open ? null : cabin.id)}
                className={`inline-flex min-h-12 cursor-pointer items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2 text-sm font-extrabold ${
                  open ? "" : "btn-chip"
                }`}
                style={
                  open
                    ? {
                        backgroundColor: cabin.swatch,
                        borderColor: inkOn(cabin.swatch),
                        color: inkOn(cabin.swatch),
                      }
                    : undefined
                }
              >
                <span
                  aria-hidden
                  className="h-5 w-5 shrink-0 rounded-full border-2 shadow-sm"
                  style={{
                    backgroundColor: cabin.swatch,
                    borderColor: open ? inkOn(cabin.swatch) : "rgba(255,255,255,0.85)",
                  }}
                />
                {cabin.name}
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={bracelet === null}
            onClick={() => selectBracelet(null)}
            className={`min-h-11 cursor-pointer rounded-xl border-2 px-3 py-2 text-sm font-extrabold ${
              bracelet === null ? "border-star bg-star text-on-star" : "btn-chip"
            }`}
          >
            Everyone
          </button>
        </div>



        {myTeam
          ? (() => {
              const cabin = activeCabinId ? getCabin(activeCabinId) : null;
              // The bracelet is the banner now. The track still decides which
              // events are listed, it is just no longer the thing a camper is
              // asked to identify with — "RED group" means nothing to a child
              // wearing a light blue band.
              const paint = cabin?.swatch ?? "#2b3a55";
              const ink = cabin ? inkOn(paint) : CAMP_PAPER;
              const scrim = cabin ? scrimOn(paint) : "rgba(255,248,238,0.16)";
              return (
                <div
                  className="mt-3 overflow-hidden rounded-2xl border-2 px-4 py-3.5 shadow-sm sm:px-5 sm:py-4"
                  style={{ backgroundColor: paint, borderColor: ink, color: ink }}
                  role="status"
                >
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] opacity-80">
                    Follow this schedule
                  </p>
                  <p className="display-font mt-1 text-2xl font-bold leading-tight sm:text-3xl">
                    {cabin ? `${cabin.name} bracelet` : "No bracelet yet"}
                  </p>
                  <p
                    className="mt-2 rounded-xl px-3 py-2 text-sm font-bold"
                    style={{ backgroundColor: scrim }}
                  >
                    {cabin
                      ? cabin.label
                      : "Ask a leader which bracelet you wear"}
                  </p>
                </div>
              );
            })()
          : null}
      </div>

      <div className="surface-card mt-4 rounded-2xl border-2 p-4">
        <NowNextBoard
          now={clock}
          live={liveEvents}
          upcoming={upcomingLanes}
          grouped={showGroupedNowNext}
          onJump={jumpToBlock}
          onViewMap={handleViewMap}
          paint={getCabin(activeCabinId)?.swatch}
        />
        <p className="mt-3 text-[11px] font-semibold text-muted-soft">
          As of {clock.toLocaleString()} · {isoDateKey(clock)}
        </p>

        {onRemindersChange ? (
          <RemindMeToggle
            enabled={Boolean(remindersOn)}
            onChange={onRemindersChange}
            trackLabel={
              activeCabinId
                ? `Cabin ${activeCabinId}`
                : myTeam?.campGroup === "red"
                ? "Red group"
                : myTeam?.campGroup === "green"
                  ? "Green group"
                  : "Everyone, Red, and Green"
            }
          />
        ) : null}
      </div>

      {mapNotice ? (
        <p className="mt-3 rounded-2xl border-2 border-star/40 bg-chip/80 px-4 py-3 text-sm font-bold text-star">
          {mapNotice}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {daysForYou.map((d) => {
          const active = d.id === dayId;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                cancelPendingScroll();
                followLiveDay.current = d.id === openDay?.id;
                setDayId(d.id);
                setHighlightId(null);
              }}
              className={`min-h-11 shrink-0 cursor-pointer rounded-xl px-3.5 py-2 text-sm font-extrabold transition ${
                active
                  ? dayActiveClass
                  : "btn-chip"
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      {/* Hidden once a team is picked — that camper has exactly one track, and
          offering the other colour is offering them somebody else's day. */}
      {isSplit && !lockedGroup ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
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
                  : "border-2 border-[#C45C26] bg-[#C45C26]/15 text-[#C45C26]"
                : id === "green"
                  ? active
                    ? "bg-[#2F8F4E] text-on-strong"
                    : "border-2 border-[#2F8F4E] bg-[#2F8F4E]/15 text-[#2F8F4E]"
                  : active
                    ? "bg-[#1E6BB8] text-on-strong"
                    : "border-2 border-[#1E6BB8] bg-[#1E6BB8]/20 text-[#1E6BB8] dark:text-[#7dd3fc]";
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  cancelPendingScroll();
                  setTrack(id);
                  setPeekFullGroup(id !== myTeam?.campGroup);
                  setHighlightId(null);
                }}
                className={`min-h-11 cursor-pointer rounded-xl border px-2 py-2 text-center text-xs font-extrabold transition sm:px-3.5 sm:text-sm ${color}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Was AnimatePresence `mode="wait"`. Changing day or track had to wait
          for the outgoing list's exit before the new one could mount, and
          framer drives that with requestAnimationFrame — so wherever rAF is
          throttled the exit never finished and tapping a day did nothing at
          all. A keyed CSS keyframe replays on each change and mounts
          immediately. */}
      <div key={`${day.id}-${track}`} className="schedule-day mt-5 space-y-6">
          {!isSplit ? (
            <Section
              title="Full day — Everyone together"
              tint="all"
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
                day={day}
              now={new Date(nowTick)}
              blocks={morning}
                highlightBlockId={highlightId}
                onViewMapFor={handleViewMap}
              />

              {track === "overview" ? (
                filterCabinId && getCabin(filterCabinId)?.group === "red" ? (
                  <Section
                    title={headingFor("red")}
                    paint={paintFor("red")}
                    tint="red"
                    day={day}
                    now={new Date(nowTick)}
                    blocks={redBlocks}
                    cabins={[cabinLabel(getCabin(filterCabinId)!)]}
                    highlightBlockId={highlightId}
                    onViewMapFor={handleViewMap}
                  />
                ) : filterCabinId && getCabin(filterCabinId)?.group === "green" ? (
                  <Section
                    title={headingFor("green")}
                    paint={paintFor("green")}
                    tint="green"
                    day={day}
                    now={new Date(nowTick)}
                    blocks={greenBlocks}
                    cabins={[cabinLabel(getCabin(filterCabinId)!)]}
                    highlightBlockId={highlightId}
                    onViewMapFor={handleViewMap}
                  />
                ) : (
                <div className="grid gap-5 lg:grid-cols-2">
                  <Section
                    title={headingFor("red")}
                    paint={paintFor("red")}
                    tint="red"
                    day={day}
                    now={new Date(nowTick)}
                    blocks={redBlocks}
                    cabins={redCabins}
                    highlightBlockId={highlightId}
                    onViewMapFor={handleViewMap}
                  />
                  <Section
                    title={headingFor("green")}
                    paint={paintFor("green")}
                    tint="green"
                    day={day}
                    now={new Date(nowTick)}
                    blocks={greenBlocks}
                    cabins={greenCabins}
                    highlightBlockId={highlightId}
                    onViewMapFor={handleViewMap}
                  />
                </div>
                )
              ) : null}

              {track === "red" ? (
                <Section
                  title={headingFor("red")}
                    paint={paintFor("red")}
                  tint="red"
                  day={day}
                  now={new Date(nowTick)}
                  blocks={redBlocks}
                  cabins={
                    filterCabinId && getCabin(filterCabinId)?.group === "red"
                      ? [cabinLabel(getCabin(filterCabinId)!)]
                      : redCabins
                  }
                  highlightBlockId={highlightId}
                  onViewMapFor={handleViewMap}
                />
              ) : null}

              {track === "green" ? (
                <Section
                  title={headingFor("green")}
                    paint={paintFor("green")}
                  tint="green"
                  day={day}
                  now={new Date(nowTick)}
                  blocks={greenBlocks}
                  cabins={
                    filterCabinId && getCabin(filterCabinId)?.group === "green"
                      ? [cabinLabel(getCabin(filterCabinId)!)]
                      : greenCabins
                  }
                  highlightBlockId={highlightId}
                  onViewMapFor={handleViewMap}
                />
              ) : null}

              <Section
                title="Evening — Everyone together"
                tint="all"
                day={day}
              now={new Date(nowTick)}
              blocks={evening}
                highlightBlockId={highlightId}
                onViewMapFor={handleViewMap}
              />
            </>
          )}
      </div>
    </section>
  );
}
