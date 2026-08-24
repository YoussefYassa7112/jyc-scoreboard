"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
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
  const behindLeader = standings[0] ? standings[0].score - team.score : 0;
  const toCatch = ahead ? ahead.score - team.score : 0;
  const group = groupLabel(team.campGroup);
  const cabin =
    typeof team.cabinId === "number" ? `Cabin ${team.cabinId}` : "No cabin";
  return { ahead, behindLeader, toCatch, group, cabin };
}

export function StandingsList({ standings, presentation = false }: Props) {
  const leaderScore = standings[0]?.score ?? 0;

  return (
    <LayoutGroup>
      <ul className={`flex flex-col ${presentation ? "gap-2 pt-0" : "gap-3 pt-2"}`}>
        <AnimatePresence initial={false}>
          {standings.map((team, index) => {
            const dark = needsDarkText(team.color);
            const topThree = team.rank <= 3;
            const isFirst = team.rank === 1;
            const badge =
              team.rank === 1 ? "👑" : team.rank === 2 ? "⭐" : team.rank === 3 ? "🚀" : null;
            const { ahead, behindLeader, toCatch, group, cabin } = teamMeta(
              team,
              standings,
              index,
            );
            const vsLeader =
              leaderScore > 0 ? Math.max(8, (team.score / leaderScore) * 100) : 0;
            const gapCopy = isFirst
              ? standings[1]
                ? `+${team.score - standings[1].score} on 2nd`
                : "In the lead"
              : toCatch === 0
                ? `Tied with ${ahead?.name ?? "next"}`
                : `−${toCatch} to #${team.rank - 1}`;

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
                <div
                  className={`relative flex items-center ${
                    presentation
                      ? "gap-2.5 py-2.5 pl-5 pr-3 sm:gap-3 sm:py-3 sm:pl-6 sm:pr-4"
                      : "gap-3 py-3 pl-5 pr-3 sm:gap-4 sm:py-4 sm:pl-6 sm:pr-5"
                  }`}
                >
                  <div
                    className={`display-font relative flex shrink-0 items-center justify-center rounded-xl font-bold ${
                      presentation
                        ? "h-10 w-10 text-lg sm:h-12 sm:w-12 sm:text-xl"
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
                      className={`display-font truncate font-bold text-card-ink ${
                        presentation
                          ? "text-base sm:text-xl md:text-2xl"
                          : "text-lg sm:text-2xl md:text-3xl"
                      }`}
                    >
                      {team.name}
                    </p>
                    {presentation ? (
                      <p className="mt-0.5 truncate text-[11px] font-bold text-muted-soft sm:text-xs">
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
                        {gapCopy ? ` · ${gapCopy}` : ""}
                        {!isFirst && behindLeader > 0 && behindLeader !== toCatch
                          ? ` · −${behindLeader} from 1st`
                          : ""}
                      </p>
                    ) : (
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-soft sm:text-sm">
                        Rank #{team.rank}
                        {isFirst ? " · 1st place" : ""}
                        {team.rank === 2 ? " · 2nd place" : ""}
                        {team.rank === 3 ? " · 3rd place" : ""}
                      </p>
                    )}
                    {presentation ? (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-chip">
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
                        ? "text-[1.45rem] sm:text-3xl md:text-4xl"
                        : "text-[1.65rem] sm:text-4xl md:text-5xl"
                    }`}
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
  );
}
