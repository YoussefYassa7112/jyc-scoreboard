"use client";

import type { ScheduleBlock, ScheduleGroup } from "@/data/schedule";
import { mappedLocations } from "@/data/locations";
import {
  eventCountdown,
  formatCountdown,
  type NextEventResult,
  type TimedEvent,
} from "@/lib/schedule-time";

export type UpcomingLane = {
  track: ScheduleGroup;
  result: NextEventResult;
};

type Props = {
  now: Date;
  live: TimedEvent[];
  upcoming: UpcomingLane[];
  grouped: boolean;
  onJump: (dayId: string, blockId: string, group: ScheduleGroup) => void;
  onViewMap?: (block: ScheduleBlock, locationId?: string) => void;
};

function trackTheme(track: ScheduleGroup) {
  if (track === "red") {
    return {
      label: "Red",
      bar: "bg-[#C45C26]",
      border: "border-[#C45C26]/50",
      chip: "bg-[#C45C26] text-white",
      time: "text-[#C45C26]",
    };
  }
  if (track === "green") {
    return {
      label: "Green",
      bar: "bg-[#2F8F4E]",
      border: "border-[#2F8F4E]/50",
      chip: "bg-[#2F8F4E] text-white",
      time: "text-[#2F8F4E]",
    };
  }
  return {
    label: "Everyone",
    bar: "bg-[#1E6BB8]",
    border: "border-[#1E6BB8]/45",
    chip: "bg-[#1E6BB8] text-white",
    time: "text-[#1E6BB8]",
  };
}

function JumpButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="btn-cta min-h-11 cursor-pointer rounded-xl bg-star px-3 py-2 text-[11px] font-extrabold"
      onClick={onClick}
    >
      {label} →
    </button>
  );
}

function MapButton({
  block,
  onViewMap,
}: {
  block: ScheduleBlock;
  onViewMap?: (block: ScheduleBlock, locationId?: string) => void;
}) {
  if (!onViewMap || !(block.locationIds?.length || block.location)) return null;
  const spots = mappedLocations(block.locationIds);
  return (
    <button
      type="button"
      className="btn-cta min-h-11 cursor-pointer rounded-xl bg-star px-3 py-2 text-[11px] font-extrabold"
      onClick={() => onViewMap(block, spots[0]?.id)}
    >
      See where this is on the map →
    </button>
  );
}

function LiveCard({
  item,
  now,
  onJump,
  onViewMap,
}: {
  item: TimedEvent;
  now: Date;
  onJump: Props["onJump"];
  onViewMap?: Props["onViewMap"];
}) {
  const theme = trackTheme(item.block.group);
  const count = eventCountdown(item.day, item.block, now);

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border-2 bg-card p-3.5 ${theme.border}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${theme.bar}`}
        aria-hidden
      />
      <div className="pl-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${theme.chip}`}
          >
            {theme.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
            Live
          </span>
        </div>
        <h3 className="display-font mt-1.5 text-base font-bold text-card-ink sm:text-lg">
          {item.block.title}
        </h3>
        <p className={`mt-0.5 text-xs font-extrabold ${theme.time}`}>
          {item.block.time}
          {item.block.location ? ` · ${item.block.location}` : ""}
        </p>
        {count ? (
          <p className="mt-2 flex items-center gap-2 text-sm font-extrabold text-red-600">
            Ends in
            <span className="countdown">{formatCountdown(count.endsIn)}</span>
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <JumpButton
            label="Jump to this event"
            onClick={() => onJump(item.day.id, item.block.id, item.block.group)}
          />
          <MapButton block={item.block} onViewMap={onViewMap} />
        </div>
      </div>
    </article>
  );
}

function NextCard({
  lane,
  now,
  onJump,
  onViewMap,
}: {
  lane: UpcomingLane;
  now: Date;
  onJump: Props["onJump"];
  onViewMap?: Props["onViewMap"];
}) {
  const theme = trackTheme(lane.track);
  const result = lane.result;

  if (result.kind === "after") {
    return (
      <article
        className={`relative overflow-hidden rounded-2xl border-2 bg-card p-3.5 ${theme.border}`}
      >
        <span
          className={`absolute inset-y-0 left-0 w-1.5 ${theme.bar}`}
          aria-hidden
        />
        <div className="pl-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${theme.chip}`}
          >
            {theme.label} next
          </span>
          <p className="mt-2 text-sm font-semibold text-muted">
            No more timed events on this track.
          </p>
        </div>
      </article>
    );
  }

  if (result.kind === "none") {
    return (
      <article
        className={`relative overflow-hidden rounded-2xl border-2 bg-card p-3.5 ${theme.border}`}
      >
        <span
          className={`absolute inset-y-0 left-0 w-1.5 ${theme.bar}`}
          aria-hidden
        />
        <div className="pl-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${theme.chip}`}
          >
            {theme.label} next
          </span>
          <p className="mt-2 text-sm font-semibold text-muted">
            No timed events available yet.
          </p>
        </div>
      </article>
    );
  }

  const count = eventCountdown(result.day, result.block, now);
  const eventTheme = trackTheme(result.block.group);
  const campStart = result.kind === "before";

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border-2 bg-card p-3.5 ${eventTheme.border}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${eventTheme.bar}`}
        aria-hidden
      />
      <div className="pl-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${eventTheme.chip}`}
        >
          {eventTheme.label}
        </span>
        <h3 className="display-font mt-1.5 text-base font-bold text-card-ink sm:text-lg">
          {result.block.title}
        </h3>
        <p className="mt-0.5 text-sm font-semibold text-muted">
          {campStart ? `Camp starts · ${result.day.dateLabel}` : result.day.dateLabel}
          {result.block.time ? ` · ${result.block.time}` : ""}
        </p>
        {result.block.location ? (
          <p className="mt-1 text-sm font-bold text-accent">
            {result.block.location}
          </p>
        ) : null}
        {count ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-chip/80 px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-soft">
                Starts in
              </p>
              <p className="countdown display-font mt-0.5 text-base font-bold text-card-ink">
                {formatCountdown(count.startsIn)}
              </p>
            </div>
            <div className="rounded-xl bg-chip/80 px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-soft">
                Ends in
              </p>
              <p className="countdown display-font mt-0.5 text-base font-bold text-card-ink">
                {formatCountdown(count.endsIn)}
              </p>
            </div>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <JumpButton
            label="Jump to this day"
            onClick={() =>
              onJump(result.day.id, result.block.id, result.block.group)
            }
          />
          <MapButton block={result.block} onViewMap={onViewMap} />
        </div>
      </div>
    </article>
  );
}

export function NowNextBoard({
  now,
  live,
  upcoming,
  grouped,
  onJump,
  onViewMap,
}: Props) {
  const campOver =
    upcoming.length > 0 && upcoming.every((lane) => lane.result.kind === "after");

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border-2 border-star/35 bg-chip/50">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-star px-3.5 py-2.5">
          <h3 className="display-font text-lg font-bold text-on-star sm:text-xl">
            Happening now
          </h3>
          {live.length > 1 ? (
            <p className="text-[11px] font-extrabold text-on-star/90">
              {live.length} events at the same time
            </p>
          ) : null}
        </div>
        <div className="p-3 sm:p-3.5">
          {live.length === 0 ? (
            <p className="text-sm font-bold text-muted">
              Nothing is happening right now.
            </p>
          ) : (
            <div
              className={`grid gap-2.5 ${
                live.length > 1 ? "sm:grid-cols-2" : ""
              }`}
            >
              {live.map((item) => (
                <LiveCard
                  key={`${item.day.id}-${item.block.id}`}
                  item={item}
                  now={now}
                  onJump={onJump}
                  onViewMap={onViewMap}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border-2 border-star/40 bg-star/10">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-star px-3.5 py-2.5">
          <h3 className="display-font text-lg font-bold text-on-star sm:text-xl">
            Coming up next
          </h3>
          {grouped ? (
            <p className="text-[11px] font-extrabold text-on-star/90">
              Everyone · Red · Green
            </p>
          ) : null}
        </div>
        <div className="p-3 sm:p-3.5">
          {campOver ? (
            <p className="text-sm font-bold text-muted">
              Camp is over — thanks for an amazing weekend!
            </p>
          ) : (
            <div
              className={`grid gap-2.5 ${
                grouped ? "lg:grid-cols-3" : ""
              }`}
            >
              {upcoming.map((lane) => (
                <NextCard
                  key={lane.track}
                  lane={lane}
                  now={now}
                  onJump={onJump}
                  onViewMap={onViewMap}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
