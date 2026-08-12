"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { firstMappedLocationId, getLocation } from "@/data/locations";
import {
  campDays,
  greenCabins,
  redCabins,
  type ScheduleBlock,
} from "@/data/schedule";
import {
  readMyTeamSnapshot,
  writeMyTeamSnapshot,
  type MyTeamSnapshot,
} from "@/lib/offline";
import type { StandingRow } from "@/lib/standings";
import {
  eventDateTimes,
  findCampDayForDate,
  findNextEvent,
  formatCountdown,
  isoDateKey,
} from "@/lib/schedule-time";

type TrackFilter = "overview" | "red" | "green";

type Props = {
  teams: StandingRow[];
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
    };
  }
  if (chrome === "red") {
    return {
      cardBorder: "border-[#C45C26]/55 border-l-[#C45C26]",
      time: "text-[#C45C26]",
      ring: "ring-[#C45C26]",
    };
  }
  return {
    cardBorder: "border-saddle/20 border-l-[#1E6BB8]",
    time: "text-[#1E6BB8]",
    ring: "ring-woody",
  };
}

function BlockCard({
  block,
  accent,
  chrome,
  highlighted,
  onViewMap,
}: {
  block: ScheduleBlock;
  accent: "all" | "red" | "green";
  /** Active track color — tints times/outlines for green vs red */
  chrome: "all" | "red" | "green";
  highlighted?: boolean;
  onViewMap?: () => void;
}) {
  // Prefer the selected track color so shared "everyone" blocks match Red/Green.
  const colorKey = chrome !== "all" ? chrome : accent;
  const colors = chromeClasses(colorKey);

  return (
    <motion.article
      layout
      id={`schedule-block-${block.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-l-4 bg-card p-3.5 text-card-ink shadow-sm sm:p-4 ${colors.cardBorder} ${
        highlighted ? `ring-2 ${colors.ring} ring-offset-2 ring-offset-transparent` : ""
      }`}
    >
      {block.time ? (
        <p
          className={`text-xs font-extrabold uppercase tracking-wide sm:text-sm ${colors.time}`}
        >
          {block.time}
        </p>
      ) : null}
      <h4 className="display-font mt-0.5 text-base font-bold text-card-ink sm:text-lg">
        {block.title}
      </h4>
      {block.location ? (
        <p className="mt-1 text-sm font-bold text-accent">
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
  blocks,
  cabins,
  highlightBlockId,
  onViewMapFor,
}: {
  title: string;
  tint: "all" | "red" | "green";
  chrome: "all" | "red" | "green";
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
        {blocks.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            accent={tint}
            chrome={chrome}
            highlighted={highlightBlockId === block.id}
            onViewMap={onViewMapFor ? () => onViewMapFor(block) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export function CampSchedule({
  teams,
  focusDayId,
  focusBlockId,
  focusGroup,
  scrollNonce,
  onScheduleFocusConsumed,
  onViewLocation,
}: Props) {
  const todayDay = findCampDayForDate();
  const [dayId, setDayId] = useState(
    () => todayDay?.id ?? campDays[0]?.id ?? "day-1",
  );
  const [track, setTrack] = useState<TrackFilter>("overview");
  const [myTeamId, setMyTeamId] = useState<number | "">("");
  const [teamSnapshot, setTeamSnapshot] = useState<MyTeamSnapshot | null>(null);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [localScrollNonce, setLocalScrollNonce] = useState(0);
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
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
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

  const day = useMemo(
    () => campDays.find((d) => d.id === dayId) ?? campDays[0],
    [dayId],
  );

  const nextInfo = useMemo(() => {
    void nowTick;
    const group =
      myTeam?.campGroup === "red" || myTeam?.campGroup === "green"
        ? myTeam.campGroup
        : track === "overview"
          ? "overview"
          : track;
    return findNextEvent(group, new Date(nowTick));
  }, [myTeam?.campGroup, track, nowTick]);

  const nextCountdown = useMemo(() => {
    if (nextInfo.kind !== "next" && nextInfo.kind !== "before") return null;
    const times = eventDateTimes(nextInfo.day, nextInfo.block);
    if (!times) return null;
    const now = nowTick;
    return {
      startsIn: times.start.getTime() - now,
      endsIn: times.end.getTime() - now,
      inProgress: now >= times.start.getTime() && now < times.end.getTime(),
      ended: now >= times.end.getTime(),
    };
  }, [nextInfo, nowTick]);

  const isSplit = day.mode === "split";
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
            <option value="">Choose your team</option>
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
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-soft">
          Next up
        </p>
        {nextInfo.kind === "next" || nextInfo.kind === "before" ? (
          <>
            <p className="display-font mt-1 text-lg font-bold text-card-ink">
              {nextInfo.block.title}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-muted">
              {nextInfo.kind === "before"
                ? `Camp starts · ${nextInfo.day.dateLabel}`
                : nextInfo.day.dateLabel}
              {nextInfo.block.time ? ` · ${nextInfo.block.time}` : ""}
            </p>
            {nextInfo.block.location ? (
              <p className="mt-1 text-sm font-bold text-accent">
                {nextInfo.block.location}
              </p>
            ) : null}
            {nextCountdown ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-chip/80 px-2.5 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-soft">
                    {nextCountdown.inProgress ? "Started" : "Starts in"}
                  </p>
                  <p className="display-font text-base font-bold tabular-nums text-card-ink">
                    {nextCountdown.inProgress
                      ? "Now"
                      : formatCountdown(nextCountdown.startsIn)}
                  </p>
                </div>
                <div className="rounded-xl bg-chip/80 px-2.5 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-soft">
                    Ends in
                  </p>
                  <p className="display-font text-base font-bold tabular-nums text-card-ink">
                    {nextCountdown.ended
                      ? "Done"
                      : formatCountdown(nextCountdown.endsIn)}
                  </p>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="btn-soft mt-3 rounded-xl border px-3 py-1.5 text-xs font-extrabold"
              onClick={() =>
                jumpToBlock(
                  nextInfo.day.id,
                  nextInfo.block.id,
                  nextInfo.block.group,
                )
              }
            >
              Jump to this day
            </button>
          </>
        ) : nextInfo.kind === "after" ? (
          <p className="mt-1 text-sm font-semibold text-muted">
            Camp is over — thanks for an amazing weekend!
          </p>
        ) : (
          <p className="mt-1 text-sm font-semibold text-muted">
            No timed events available yet.
          </p>
        )}
        <p className="mt-2 text-[11px] font-semibold text-muted-soft">
          As of {new Date(nowTick).toLocaleString()} · {isoDateKey(new Date())}
        </p>
      </div>

      {mapNotice ? (
        <p className="mt-3 rounded-2xl border-2 border-woody/40 bg-chip/80 px-4 py-3 text-sm font-bold text-woody">
          {mapNotice}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {campDays.map((d) => {
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
              ["overview", "Full day"],
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
                    blocks={redBlocks}
                    cabins={redCabins}
                    highlightBlockId={highlightId}
                    onViewMapFor={handleViewMap}
                  />
                  <Section
                    title="Green group"
                    tint="green"
                    chrome="green"
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
