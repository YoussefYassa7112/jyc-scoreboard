"use client";

import { useMemo } from "react";
import type { StandingRow } from "@/lib/standings";

type Props = {
  standings: StandingRow[];
};

function Chip({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-saddle/15 bg-chip/70 px-2.5 py-2 dark:border-white/10 sm:px-3 sm:py-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-soft">
        {label}
      </p>
      <p
        className="display-font mt-0.5 truncate text-base font-bold leading-tight text-card-ink sm:text-xl"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 hidden truncate text-[11px] font-bold text-muted-soft sm:block">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function CampStatStrip({ standings }: Props) {
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

  return (
    <section
      aria-label="Camp stats"
      className="panel flex shrink-0 flex-col gap-2 rounded-3xl p-2.5 sm:gap-3 sm:p-4"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Chip
          label="Leader"
          value={stats.leader?.name ?? "—"}
          hint={stats.leader ? `${stats.leader.score} pts` : undefined}
        />
        <Chip
          label="Red camp"
          value={String(stats.red)}
          hint="group total"
          accent="#C45C26"
        />
        <Chip
          label="Green camp"
          value={String(stats.green)}
          hint="group total"
          accent="#2F8F4E"
        />
        <Chip label="All points" value={String(stats.total)} hint={`${standings.length} teams`} />
        <Chip
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
