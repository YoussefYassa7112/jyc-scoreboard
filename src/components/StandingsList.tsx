"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { needsDarkText } from "@/lib/utils";
import type { StandingRow } from "@/lib/standings";

type Props = {
  standings: StandingRow[];
  presentation?: boolean;
};

function groupLabel(group: StandingRow["campGroup"]) {
  if (group === "red") return "Red";
  if (group === "green") return "Green";
  return null;
}

function teamMeta(team: StandingRow, standings: StandingRow[], index: number) {
  const ahead = index > 0 ? standings[index - 1] : null;
  const behind = standings[index + 1] ?? null;
  const leader = standings[0] ?? null;
  const group = groupLabel(team.campGroup);
  const cabin =
    typeof team.cabinId === "number" ? `Cabin ${team.cabinId}` : "No cabin";
  return { ahead, behind, leader, group, cabin };
}

function chaseLines(team: StandingRow, standings: StandingRow[], index: number) {
  const { ahead, behind, leader } = teamMeta(team, standings, index);
  if (index === 0) {
    return behind
      ? [`Leading by ${team.score - behind.score} pts over ${behind.name}`]
      : ["In the lead"];
  }
  const lines: string[] = [];
  if (ahead) {
    const gap = ahead.score - team.score;
    lines.push(
      gap === 0
        ? `Tied with ${ahead.name}`
        : `${gap} pts to catch ${ahead.name} (#${ahead.rank})`,
    );
  }
  if (leader && leader.id !== ahead?.id) {
    lines.push(
      `${leader.score - team.score} pts to catch 1st · ${leader.name}`,
    );
  }
  if (behind && team.score - behind.score > 0) {
    lines.push(
      `${team.score - behind.score} pts ahead of ${behind.name} (#${behind.rank})`,
    );
  }
  return lines;
}

export function StandingsList({ standings, presentation = false }: Props) {
  const [openId, setOpenId] = useState<number | null>(null);
  const leaderScore = standings[0]?.score ?? 0;

  return (
    <ul className={`flex min-w-0 flex-col ${presentation ? "gap-1 pt-0 sm:gap-2" : "gap-3 pt-2"}`}>
      <AnimatePresence initial={false}>
        {standings.map((team, index) => {
            const dark = needsDarkText(team.color);
            const topThree = team.rank <= 3;
            const isFirst = team.rank === 1;
            const open = openId === team.id;
            const badge =
              team.rank === 1 ? "👑" : team.rank === 2 ? "⭐" : team.rank === 3 ? "🚀" : null;
            const { ahead, group, cabin } = teamMeta(team, standings, index);
            const vsLeader =
              leaderScore > 0 ? Math.max(8, (team.score / leaderScore) * 100) : 0;
            const lines = chaseLines(team, standings, index);
            const preview = lines[0] ?? "";

            return (
              <motion.li
                key={team.id}
                layout="position"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{
                  layout: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
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
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={
                    open
                      ? `Hide chase details for ${team.name}`
                      : `Show how ${team.name} can catch the ranks above`
                  }
                  onClick={() =>
                    setOpenId((current) => (current === team.id ? null : team.id))
                  }
                  className="relative w-full cursor-pointer text-left"
                >
                <div
                  className={`relative flex w-full min-w-0 items-center ${
                    presentation
                      ? "gap-2 py-1.5 pl-4 pr-2.5 sm:gap-3 sm:py-3 sm:pl-6 sm:pr-4"
                      : "gap-3 py-3 pl-5 pr-3 sm:gap-4 sm:py-4 sm:pl-6 sm:pr-5"
                  }`}
                >
                  <div
                    className={`display-font relative flex shrink-0 items-center justify-center rounded-xl font-bold ${
                      presentation
                        ? "h-8 w-8 text-sm sm:h-12 sm:w-12 sm:text-xl"
                        : "h-12 w-12 text-xl sm:h-14 sm:w-14 sm:text-2xl"
                    }`}
                    style={{
                      backgroundColor: team.color,
                      color: dark ? "#2a1f14" : "#fff8ee",
                      boxShadow: topThree ? "0 0 0 3px rgba(232, 185, 35, 0.55)" : undefined,
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
                    <p
                      className={`display-font min-w-0 font-bold text-card-ink ${
                        presentation
                          ? "break-words text-sm leading-tight sm:text-lg md:text-xl"
                          : "truncate text-lg sm:text-2xl md:text-3xl"
                      }`}
                    >
                      {team.name}
                    </p>
                    {presentation ? (
                      <>
                        <p className="mt-0.5 text-[10px] font-extrabold text-muted-soft sm:hidden">
                          {open ? "Tap to hide" : "Tap for gaps"}
                        </p>
                        <p className="mt-0.5 hidden text-[11px] font-bold text-muted-soft sm:block sm:text-xs">
                          <span
                            className={
                              team.campGroup === "red"
                                ? "text-[#C45C26]"
                                : team.campGroup === "green"
                                  ? "text-[#2F8F4E]"
                                  : ""
                            }
                          >
                            {group ?? "Ungrouped"}
                          </span>
                          {" · "}
                          {cabin}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-soft sm:text-sm">
                        Rank #{team.rank}
                        {isFirst ? " · 1st place" : ""}
                        {team.rank === 2 ? " · 2nd place" : ""}
                        {team.rank === 3 ? " · 3rd place" : ""}
                      </p>
                    )}
                    <div
                      className={`${presentation ? "hidden sm:grid" : "grid"} transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                        open ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                      }`}
                    >
                      <p className="mt-0.5 min-h-0 overflow-hidden text-[11px] font-bold leading-snug text-muted sm:text-xs">
                        {preview}
                        <span className="ml-1 font-extrabold text-muted-soft">
                          · tap for more
                        </span>
                      </p>
                    </div>
                    {presentation ? (
                      <div className="mt-1 hidden h-1.5 overflow-hidden rounded-full bg-chip sm:block">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${vsLeader}%`,
                            backgroundColor: team.color,
                          }}
                        />
                      </div>
                    ) : null}
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
                    className={`display-font shrink-0 font-bold tabular-nums leading-none text-card-ink ${
                      presentation
                        ? "text-xl sm:text-3xl md:text-4xl"
                        : "text-[1.65rem] sm:text-4xl md:text-5xl"
                    }`}
                  >
                    {team.score}
                  </motion.div>
                </div>

                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div
                    className="min-h-0 overflow-hidden"
                    inert={!open || undefined}
                    aria-hidden={!open}
                  >
                    <div
                      className={`space-y-1.5 border-t border-saddle/15 pb-3 pr-3 ${
                        presentation ? "pl-4 pt-2 sm:pl-6" : "pl-5 pt-2.5 sm:pl-6"
                      }`}
                    >
                      {lines.map((line) => (
                        <p
                          key={line}
                          className="text-sm font-extrabold leading-snug text-card-ink"
                        >
                          {line}
                        </p>
                      ))}
                      {ahead && team.score < ahead.score ? (
                        <p className="text-xs font-bold text-muted-soft">
                          One score bump from {ahead.name} and you swap places.
                        </p>
                      ) : null}
                      <p className="text-xs font-extrabold text-muted-soft">
                        Tap to hide
                      </p>
                    </div>
                  </div>
                </div>
                </button>
              </motion.li>
            );
          })}
      </AnimatePresence>
    </ul>
  );
}
