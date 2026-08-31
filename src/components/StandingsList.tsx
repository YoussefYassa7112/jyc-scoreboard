"use client";

import { memo, useEffect, useRef, useState } from "react";
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

function groupAccent(group: StandingRow["campGroup"]) {
  if (group === "red") return "#C45C26";
  if (group === "green") return "#2F8F4E";
  return undefined;
}

function chaseLines(team: StandingRow, standings: StandingRow[], index: number) {
  const { ahead, behind, leader } = teamMeta(team, standings, index);
  if (index === 0) {
    if (!behind) return ["In the lead"];
    const lead = team.score - behind.score;
    // Ranks are shared, so the top of the list can be a tie rather than a lead.
    return lead === 0
      ? [`Tied for the lead with ${behind.name}`]
      : [`Leading by ${lead} pts over ${behind.name}`];
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

function chaseIcon(line: string, isFirst: boolean) {
  if (isFirst && line.startsWith("Leading")) return "👑";
  if (isFirst && line === "In the lead") return "👑";
  if (line.startsWith("Tied")) return "🤝";
  if (line.includes("to catch 1st")) return "🏔️";
  if (line.includes("to catch")) return "🎯";
  if (line.includes("ahead of")) return "🛡️";
  return "✨";
}

function ChaseDetails({
  team,
  standings,
  index,
  compact,
}: {
  team: StandingRow;
  standings: StandingRow[];
  index: number;
  compact?: boolean;
}) {
  const { ahead, behind, leader, group, cabin } = teamMeta(
    team,
    standings,
    index,
  );
  const isFirst = index === 0;
  const lines = chaseLines(team, standings, index);
  const summit = standings[0]?.score ?? 0;
  const scale = Math.max(summit, team.score, 1);
  const youPct = (team.score / scale) * 100;
  const aheadPct = ahead ? (ahead.score / scale) * 100 : 100;
  const gapToAhead =
    ahead && team.score < ahead.score ? ahead.score - team.score : 0;
  const gapToFirst =
    leader && leader.id !== team.id ? leader.score - team.score : 0;
  const cushion =
    behind && team.score > behind.score ? team.score - behind.score : 0;
  const groupColor = groupAccent(team.campGroup);

  return (
    <div
      className="chase-panel"
      style={{ "--chase-accent": team.color } as React.CSSProperties}
    >
      <div className={`chase-panel-inner ${compact ? "chase-panel-compact" : ""}`}>
        <div className="chase-header">
          {group ? (
            <span
              className="chase-camp-badge"
              style={
                groupColor
                  ? {
                      color: groupColor,
                      borderColor: `${groupColor}55`,
                      backgroundColor: `${groupColor}18`,
                    }
                  : undefined
              }
            >
              {group} camp
            </span>
          ) : (
            <span className="chase-camp-badge chase-camp-badge-muted">
              Ungrouped
            </span>
          )}
          <span className="chase-cabin">{cabin}</span>
        </div>

        <div className="chase-orbit-block">
          <div className="chase-orbit-labels">
            <span>{isFirst ? "Summit" : "Your orbit"}</span>
            <span className="chase-orbit-score display-font tabular-nums">
              {team.score}
              {!isFirst && summit > 0 ? (
                <span className="text-muted-soft"> / {summit}</span>
              ) : null}
            </span>
          </div>
          <div className="chase-orbit-rail" aria-hidden>
            <div
              className="chase-orbit-fill"
              style={{ width: `${Math.max(youPct, 6)}%` }}
            />
            {!isFirst && gapToAhead > 0 ? (
              <div
                className="chase-orbit-gap"
                style={{
                  left: `${youPct}%`,
                  width: `${Math.max(aheadPct - youPct, 2)}%`,
                }}
              />
            ) : null}
            <div
              className="chase-orbit-marker chase-orbit-you"
              style={{ left: `${Math.min(Math.max(youPct, 4), 96)}%` }}
              title={`${team.name}: ${team.score}`}
            />
            {!isFirst && ahead ? (
              <div
                className="chase-orbit-marker chase-orbit-target"
                style={{ left: `${Math.min(aheadPct, 98)}%` }}
                title={`#${ahead.rank} ${ahead.name}`}
              />
            ) : null}
            <div className="chase-orbit-summit" title={`#1 · ${summit} pts`}>
              {isFirst ? "👑" : "🏔️"}
            </div>
          </div>
          {!isFirst && ahead ? (
            <p className="chase-orbit-hint">
              <span className="font-extrabold text-card-ink">#{ahead.rank}</span>
              {" · "}
              {ahead.name}
              {gapToAhead > 0 ? ` · ${gapToAhead} pts up` : ""}
            </p>
          ) : isFirst && behind ? (
            <p className="chase-orbit-hint">
              <span className="font-extrabold text-card-ink">#{behind.rank}</span>
              {" · "}
              {behind.name}
              {" · "}
              {cushion} pts behind you
            </p>
          ) : null}
        </div>

        <div className="chase-metrics">
          {isFirst ? (
            <>
              <div className="chase-metric chase-metric-hero">
                <span className="chase-metric-icon" aria-hidden>
                  👑
                </span>
                <span className="chase-metric-value display-font">
                  {cushion || "—"}
                </span>
                <span className="chase-metric-label">
                  {cushion ? "pt lead" : "On top"}
                </span>
              </div>
              {behind ? (
                <div className="chase-metric">
                  <span className="chase-metric-icon" aria-hidden>
                    👀
                  </span>
                  <span className="chase-metric-value display-font truncate">
                    {behind.name}
                  </span>
                  <span className="chase-metric-label">Chasing you</span>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {gapToAhead > 0 ? (
                <div className="chase-metric">
                  <span className="chase-metric-icon" aria-hidden>
                    🎯
                  </span>
                  <span className="chase-metric-value display-font">
                    +{gapToAhead}
                  </span>
                  <span className="chase-metric-label">
                    to #{ahead?.rank ?? "—"}
                  </span>
                </div>
              ) : null}
              {gapToFirst > 0 && leader?.id !== ahead?.id ? (
                <div className="chase-metric">
                  <span className="chase-metric-icon" aria-hidden>
                    🏔️
                  </span>
                  <span className="chase-metric-value display-font">
                    +{gapToFirst}
                  </span>
                  <span className="chase-metric-label">to 1st</span>
                </div>
              ) : null}
              {cushion > 0 ? (
                <div className="chase-metric">
                  <span className="chase-metric-icon" aria-hidden>
                    🛡️
                  </span>
                  <span className="chase-metric-value display-font">
                    {cushion}
                  </span>
                  <span className="chase-metric-label">
                    cushion vs #{behind?.rank}
                  </span>
                </div>
              ) : null}
            </>
          )}
        </div>

        <ul className="chase-cards">
          {lines.map((line) => (
            <li key={line} className="chase-card">
              <span className="chase-card-icon" aria-hidden>
                {chaseIcon(line, isFirst)}
              </span>
              <span className="chase-card-text">{line}</span>
            </li>
          ))}
        </ul>

        {ahead && team.score < ahead.score ? (
          <p className="chase-tip">
            One score bump from{" "}
            <span className="font-extrabold text-card-ink">{ahead.name}</span> and
            you swap places.
          </p>
        ) : null}
      </div>
    </div>
  );
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
    if (!behind) return "In the lead";
    const lead = team.score - behind.score;
    return lead === 0 ? "Tied for the lead" : `Leading by ${lead}`;
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

// Memoised because the board re-renders on every tab change, and re-rendering
// eight cards plus their drawers is enough main-thread work on a phone to hold
// up the paint of the tab highlight the camper just tapped.
export const StandingsList = memo(function StandingsList({
  standings,
  presentation = false,
}: Props) {
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
                  <ChaseDetails
                    team={team}
                    standings={standings}
                    index={index}
                    compact={presentation}
                  />
                </ChaseDrawer>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </LayoutGroup>
  );
});
