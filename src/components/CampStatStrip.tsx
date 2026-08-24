"use client";

import { useMemo } from "react";
import type { StandingRow } from "@/lib/standings";

type Props = {
  standings: StandingRow[];
  /** `inset` is a compact footer inside the orbit card, below the graph. */
  layout?: "bar" | "stack" | "inset";
};

function Chip({
  label,
  value,
  hint,
  accent,
  compact,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-saddle/15 bg-chip/80 backdrop-blur-sm ${
        compact ? "px-2 py-1.5" : "px-2.5 py-2 sm:px-3 sm:py-2.5"
      }`}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-soft">
        {label}
      </p>
      <p
        className={`display-font mt-0.5 truncate font-bold leading-tight text-card-ink ${
          compact ? "text-sm sm:text-base" : "text-base sm:text-xl"
        }`}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {hint ? (
        <p
          className="mt-0.5 hidden truncate text-[11px] font-bold text-muted-soft sm:block"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function CampStatStrip({ standings, layout = "bar" }: Props) {
  const stacked = layout === "stack";
  const inset = layout === "inset";
  const stats = useMemo(() => {
    const total = standings.reduce((sum, team) => sum + team.score, 0);
    const red = standings
      .filter((team) => team.campGroup === "red")
      .reduce((sum, team) => sum + team.score, 0);
    const green = standings
      .filter((team) => team.campGroup === "green")
      .reduce((sum, team) => sum + team.score, 0);
    const leader = standings[0] ?? null;
    const last = standings[standings.length - 1] ?? null;
    const orbits = new Set(standings.map((team) => team.score)).size;
    const groupSum = red + green;
    return {
      total,
      red,
      green,
      leader,
      orbits,
      spread: leader && last ? leader.score - last.score : 0,
      redShare: groupSum > 0 ? (red / groupSum) * 100 : 50,
      greenShare: groupSum > 0 ? (green / groupSum) * 100 : 50,
    };
  }, [standings]);

  if (inset) {
    return (
      <section aria-label="Camp stats" className="shrink-0">
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          <Chip
            compact
            label="Leader"
            value={stats.leader?.name ?? "—"}
            hint={stats.leader ? `${stats.leader.score} pts` : undefined}
          />
          <Chip
            compact
            label="Red camp"
            value={String(stats.red)}
            hint="group total"
            accent="#C45C26"
          />
          <Chip
            compact
            label="Green camp"
            value={String(stats.green)}
            hint="group total"
            accent="#2F8F4E"
          />
          <div className="hidden sm:contents">
            <Chip
              compact
              label="All points"
              value={String(stats.total)}
              hint={`${standings.length} teams`}
            />
            <Chip
              compact
              label="Orbits"
              value={String(stats.orbits)}
              hint={stats.spread ? `spread ${stats.spread}` : "unique scores"}
            />
          </div>
        </div>
        <div className="mt-1.5">
          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-soft">
            <span>Red vs Green</span>
            <span className="normal-case tracking-normal text-muted">
              {stats.red === stats.green
                ? "Tied"
                : stats.red > stats.green
                  ? `Red +${stats.red - stats.green}`
                  : `Green +${stats.green - stats.red}`}
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full border border-saddle/15 bg-chip">
            <div
              className="h-full bg-[#C45C26] transition-[width] duration-500"
              style={{ width: `${stats.redShare}%` }}
            />
            <div
              className="h-full bg-[#2F8F4E] transition-[width] duration-500"
              style={{ width: `${stats.greenShare}%` }}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Camp stats"
      className={`panel flex shrink-0 flex-col gap-2 rounded-3xl ${
        stacked ? "p-2.5 sm:p-3" : "p-2.5 sm:gap-3 sm:p-4"
      }`}
    >
      <div
        className={`grid gap-2 ${
          stacked ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-5"
        }`}
      >
        <Chip
          compact={stacked}
          label="Leader"
          value={stats.leader?.name ?? "—"}
          hint={stats.leader ? `${stats.leader.score} pts` : undefined}
        />
        <Chip
          compact={stacked}
          label="Red camp"
          value={String(stats.red)}
          hint="group total"
          accent="#C45C26"
        />
        <Chip
          compact={stacked}
          label="Green camp"
          value={String(stats.green)}
          hint="group total"
          accent="#2F8F4E"
        />
        <Chip
          compact={stacked}
          label="All points"
          value={String(stats.total)}
          hint={`${standings.length} teams`}
        />
        <Chip
          compact={stacked}
          label="Orbits"
          value={String(stats.orbits)}
          hint={stats.spread ? `spread ${stats.spread}` : "unique scores"}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-soft">
          <span>Red vs Green</span>
          <span className="normal-case tracking-normal text-muted">
            {stats.red === stats.green
              ? "Tied"
              : stats.red > stats.green
                ? `Red +${stats.red - stats.green}`
                : `Green +${stats.green - stats.red}`}
          </span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full border border-saddle/15 bg-chip">
          <div
            className="h-full bg-[#C45C26] transition-[width] duration-500"
            style={{ width: `${stats.redShare}%` }}
          />
          <div
            className="h-full bg-[#2F8F4E] transition-[width] duration-500"
            style={{ width: `${stats.greenShare}%` }}
          />
        </div>
      </div>
    </section>
  );
}
