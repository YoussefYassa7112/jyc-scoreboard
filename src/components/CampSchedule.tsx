"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  campDays,
  greenCabins,
  redCabins,
  type ScheduleBlock,
} from "@/data/schedule";

type TrackFilter = "overview" | "red" | "green";

function BlockCard({
  block,
  accent,
}: {
  block: ScheduleBlock;
  accent: "all" | "red" | "green";
}) {
  const border =
    accent === "red"
      ? "border-l-[#C45C26]"
      : accent === "green"
        ? "border-l-[#2F8F4E]"
        : "border-l-[#1E6BB8]";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`surface-card rounded-2xl border border-saddle/20 border-l-4 bg-card p-3.5 text-card-ink shadow-sm sm:p-4 ${border}`}
    >
      {block.time ? (
        <p className="text-xs font-extrabold uppercase tracking-wide text-woody sm:text-sm">
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
    </motion.article>
  );
}

function Section({
  title,
  tint,
  blocks,
  cabins,
}: {
  title: string;
  tint: "all" | "red" | "green";
  blocks: ScheduleBlock[];
  cabins?: string[];
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
          <BlockCard key={block.id} block={block} accent={tint} />
        ))}
      </div>
    </div>
  );
}

export function CampSchedule() {
  const [dayId, setDayId] = useState(campDays[0]?.id ?? "day-1");
  const [track, setTrack] = useState<TrackFilter>("overview");

  const day = useMemo(
    () => campDays.find((d) => d.id === dayId) ?? campDays[0],
    [dayId],
  );

  const isSplit = day.mode === "split";
  const morning = day.blocks.filter(
    (b) => b.section === "morning" && b.group === "all",
  );
  const evening = day.blocks.filter(
    (b) => b.section === "evening" && b.group === "all",
  );
  const fullDay = day.blocks.filter((b) => b.section === "full");
  const redBlocks = day.blocks.filter((b) => b.group === "red");
  const greenBlocks = day.blocks.filter((b) => b.group === "green");

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

      <div className="mt-4 flex flex-wrap gap-2">
        {campDays.map((d) => {
          const active = d.id === dayId;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDayId(d.id);
                setTrack("overview");
              }}
              className={`rounded-xl px-3.5 py-2 text-sm font-extrabold transition ${
                active
                  ? "bg-woody text-on-strong shadow-sm"
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
                onClick={() => setTrack(id)}
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
              blocks={fullDay}
            />
          ) : (
            <>
              <Section
                title="Morning — Everyone together"
                tint="all"
                blocks={morning}
              />

              {track === "overview" ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  <Section
                    title="Red group"
                    tint="red"
                    blocks={redBlocks}
                    cabins={redCabins}
                  />
                  <Section
                    title="Green group"
                    tint="green"
                    blocks={greenBlocks}
                    cabins={greenCabins}
                  />
                </div>
              ) : null}

              {track === "red" ? (
                <Section
                  title="Red group"
                  tint="red"
                  blocks={redBlocks}
                  cabins={redCabins}
                />
              ) : null}

              {track === "green" ? (
                <Section
                  title="Green group"
                  tint="green"
                  blocks={greenBlocks}
                  cabins={greenCabins}
                />
              ) : null}

              <Section
                title="Evening — Everyone together"
                tint="all"
                blocks={evening}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
