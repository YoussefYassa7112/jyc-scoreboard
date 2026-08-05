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
      className={`rounded-2xl border border-saddle/15 border-l-4 bg-white/75 p-3.5 shadow-sm sm:p-4 ${border}`}
    >
      {block.time ? (
        <p className="text-xs font-extrabold uppercase tracking-wide text-woody sm:text-sm">
          {block.time}
        </p>
      ) : null}
      <h4 className="display-font mt-0.5 text-base font-bold text-ink sm:text-lg">
        {block.title}
      </h4>
      {block.location ? (
        <p className="mt-1 text-sm font-bold text-buzz">
          <span className="text-saddle/55">Location · </span>
          {block.location}
        </p>
      ) : null}
      {block.note ? (
        <p className="mt-1 text-sm font-semibold text-saddle/80">{block.note}</p>
      ) : null}
      {block.details?.length ? (
        <ul className="mt-2 space-y-1.5">
          {block.details.map((line) => (
            <li
              key={line}
              className="rounded-xl bg-cloud/80 px-2.5 py-1.5 text-xs font-semibold text-saddle sm:text-sm"
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
      ? "bg-[#C45C26] text-cloud"
      : tint === "green"
        ? "bg-[#2F8F4E] text-cloud"
        : "bg-[#1E6BB8] text-cloud";

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl px-3.5 py-2.5 ${headerBg}`}>
        <h3 className="display-font text-lg font-bold sm:text-xl">{title}</h3>
        {cabins?.length ? (
          <p className="mt-1 text-xs font-semibold opacity-90 sm:text-sm">
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
        <p className="display-font text-xs font-semibold uppercase tracking-[0.22em] text-saddle/70">
          Camp itinerary
        </p>
        <h2 className="display-font text-2xl font-bold text-ink sm:text-3xl">
          Schedule
        </h2>
        <p className="mt-1 text-sm font-semibold text-saddle/75">
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
                  ? "bg-woody text-cloud shadow-sm"
                  : "border border-saddle/20 bg-white/70 text-ink"
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
                  ? "bg-[#C45C26] text-cloud"
                  : "border-[#C45C26]/35 text-[#C45C26] bg-white/70"
                : id === "green"
                  ? active
                    ? "bg-[#2F8F4E] text-cloud"
                    : "border-[#2F8F4E]/35 text-[#2F8F4E] bg-white/70"
                  : active
                    ? "bg-buzz text-cloud"
                    : "border-saddle/20 text-ink bg-white/70";
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
