"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * Presenting squeezes camp, cabin and the chase onto one line in a narrow
 * column, so the chase is stated by rank instead of by name — the name is
 * already on the row above the one it points at. Full wording lives in the
 * drawer.
 */
function chaseSummary(
  team: StandingRow,
  standings: StandingRow[],
  index: number,
) {
  const { ahead, behind } = teamMeta(team, standings, index);
  if (index === 0) {
    return behind ? `Leading by ${team.score - behind.score}` : "In the lead";
  }
  if (!ahead) return "";
  const gap = ahead.score - team.score;
  return gap === 0
    ? `Tied with #${ahead.rank}`
    : `${gap} to catch #${ahead.rank}`;
}

/**
 * The drawer height comes from a measured pixel value instead of `height: auto`
 * so a single CSS transition owns the resize. Framer-motion is deliberately kept
 * away from this box — two animators on one height is what made it stutter.
 */
function ChaseDrawer({
  id,
  open,
  onClose,
  children,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0];
      setContentHeight(box ? box.blockSize : node.offsetHeight);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      id={id}
      className="chase-drawer"
      aria-hidden={!open}
      onClick={open ? onClose : undefined}
      style={{ height: open ? contentHeight : 0, opacity: open ? 1 : 0 }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}

export function StandingsList({ standings, presentation = false }: Props) {
  const [openId, setOpenId] = useState<number | null>(null);
  const leaderScore = standings[0]?.score ?? 0;

  return (
    <LayoutGroup>
      <ul
        className={`flex flex-col ${
          presentation ? "gap-1.5 pt-0" : "gap-3 pt-2"
        }`}
      >
        <AnimatePresence initial={false}>
          {standings.map((team, index) => {
            const dark = needsDarkText(team.color);
            const topThree = team.rank <= 3;
            const isFirst = team.rank === 1;
            const open = openId === team.id;
            const drawerId = `chase-${team.id}`;
            const badge =
              team.rank === 1 ? "👑" : team.rank === 2 ? "⭐" : team.rank === 3 ? "🚀" : null;
            const { ahead, group, cabin } = teamMeta(team, standings, index);
            const vsLeader =
              leaderScore > 0 ? Math.max(8, (team.score / leaderScore) * 100) : 0;
            const lines = chaseLines(team, standings, index);
            const preview = presentation
              ? chaseSummary(team, standings, index)
              : (lines[0] ?? "");

            return (
              <motion.li
                key={team.id}
                layout="position"
                layoutDependency={team.rank}
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
                  <div className="rank-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                ) : null}

                <div
                  className="pointer-events-none absolute inset-y-0 left-0 w-2 sm:w-2.5"
                  style={{ backgroundColor: team.color }}
                />
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={drawerId}
                  aria-label={
                    open
                      ? `Hide chase details for ${team.name}`
                      : `Show how ${team.name} can catch the ranks above`
                  }
                  onClick={() =>
                    setOpenId((current) => (current === team.id ? null : team.id))
                  }
                  className="chase-row relative w-full cursor-pointer text-left"
                >
                <div
                  className={`relative flex w-full items-center ${
                    presentation
                      ? "gap-2.5 py-2 pl-5 pr-3 sm:gap-3 sm:pl-6 sm:pr-4"
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
                      <span className="rank-badge-bob absolute -right-2 -top-2 text-base sm:text-lg">
                        {badge}
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`display-font font-bold text-card-ink ${
                        presentation
                          ? "truncate text-base leading-tight sm:text-lg"
                          : "truncate text-lg sm:text-2xl md:text-3xl"
                      }`}
                    >
                      {team.name}
                    </p>
                    {/* Presenting keeps camp, cabin and the chase on one line so
                        the top of the table fits a screen without scrolling. */}
                    {presentation ? (
                      <p className="mt-0.5 truncate text-[11px] font-bold sm:text-xs">
                        <span
                          className={
                            team.campGroup === "red"
                              ? "text-[#C45C26]"
                              : team.campGroup === "green"
                                ? "text-[#2F8F4E]"
                                : "text-muted-soft"
                          }
                        >
                          {group ?? "Ungrouped"}
                        </span>
                        <span className="text-muted-soft">
                          {" · "}
                          {cabin}
                        </span>
                        <span className="text-muted">
                          {" · "}
                          {preview}
                        </span>
                      </p>
                    ) : (
                      <>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-soft sm:text-sm">
                          Rank #{team.rank}
                          {isFirst ? " · 1st place" : ""}
                          {team.rank === 2 ? " · 2nd place" : ""}
                          {team.rank === 3 ? " · 3rd place" : ""}
                        </p>
                        {/* Wording never changes on toggle: a row that reflows at
                            the same moment as the drawer reads as a double jump.
                            The caret carries the open/closed state instead. */}
                        <p className="mt-0.5 text-[11px] font-bold leading-snug text-muted sm:text-xs">
                          {preview}
                          <span className="ml-1 font-extrabold text-muted-soft">
                            · tap for details
                          </span>
                        </p>
                      </>
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
                        ? "text-xl sm:text-2xl"
                        : "text-[1.65rem] sm:text-4xl md:text-5xl"
                    }`}
                  >
                    {team.score}
                  </motion.div>

                  <span
                    aria-hidden
                    className="chase-caret flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chip text-[0.7rem] font-bold text-muted"
                    style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    ▼
                  </span>
                </div>
                </button>

                <ChaseDrawer
                  id={drawerId}
                  open={open}
                  onClose={() => setOpenId(null)}
                >
                  <div
                    className={`space-y-1.5 border-t border-saddle/15 pb-3 pr-3 ${
                      presentation ? "pl-5 pt-2 sm:pl-6" : "pl-5 pt-2.5 sm:pl-6"
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
                  </div>
                </ChaseDrawer>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </LayoutGroup>
  );
}
