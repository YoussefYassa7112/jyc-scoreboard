"use client";

import { useMemo, useState } from "react";
import { inkOn } from "@/lib/cabins";
import { setMyTeamChoice } from "@/lib/offline";
import type { StandingRow } from "@/lib/standings";

/**
 * "Which team are you cheering for?" — asked here rather than in the schedule.
 *
 * The schedule asks for a bracelet, because that is what gets a camper to the
 * right field at the right time. This is the other question, and it only earns
 * its keep on this screen: it is what lets the board say "your team just moved
 * to 4th". The two answers live side by side in one saved record, and neither
 * write disturbs the other.
 */
export function MyTeamPicker({
  standings,
  myTeamId,
}: {
  standings: StandingRow[];
  myTeamId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const mine = useMemo(
    () => standings.find((t) => t.id === myTeamId) ?? null,
    [standings, myTeamId],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return standings;
    return standings.filter((t) => t.name.toLowerCase().includes(needle));
  }, [standings, query]);

  function choose(team: StandingRow | null) {
    setMyTeamChoice(team ? { id: team.id, name: team.name } : null);
    setOpen(false);
    setQuery("");
  }

  return (
    <section className="surface-card mb-4 rounded-2xl border-2 p-3 sm:p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-muted">My team</p>
          {mine ? (
            <p className="mt-0.5 flex items-center gap-2 text-base font-extrabold text-ink">
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 rounded-full border-2 border-white/80 shadow-sm"
                style={{ backgroundColor: mine.color }}
              />
              <span className="truncate">{mine.name}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-xs font-semibold text-muted-soft">
              Pick your team to be told when it moves up or down.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {mine ? (
            <button
              type="button"
              onClick={() => choose(null)}
              className="btn-chip min-h-11 cursor-pointer rounded-xl border-2 px-3 py-2 text-xs font-extrabold"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="btn-cta min-h-11 cursor-pointer rounded-xl bg-star px-3.5 py-2 text-xs font-extrabold text-on-star"
          >
            {open ? "Close" : mine ? "Change team" : "Pick my team"}
          </button>
        </div>
      </div>

      {/* A grid rather than a dropdown, for the same reason the bracelets are
          buttons: a native select cannot show a team's colour. */}
      {open ? (
        <div className="mt-3">
          {standings.length > 12 ? (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams…"
              aria-label="Search teams"
              className="surface-card mb-2 min-h-11 w-full rounded-xl border-2 px-3 py-2 text-sm font-bold text-ink"
            />
          ) : null}

          <div className="max-h-72 overflow-y-auto rounded-xl">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
              {shown.map((team) => {
                const picked = team.id === myTeamId;
                return (
                  <button
                    key={team.id}
                    type="button"
                    aria-pressed={picked}
                    onClick={() => choose(team)}
                    className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-extrabold ${
                      picked ? "" : "btn-chip"
                    }`}
                    style={
                      picked
                        ? {
                            backgroundColor: team.color,
                            borderColor: inkOn(team.color),
                            color: inkOn(team.color),
                          }
                        : undefined
                    }
                  >
                    <span
                      aria-hidden
                      className="h-4 w-4 shrink-0 rounded-full border-2 shadow-sm"
                      style={{
                        backgroundColor: team.color,
                        borderColor: picked
                          ? inkOn(team.color)
                          : "rgba(255,255,255,0.85)",
                      }}
                    />
                    <span className="truncate">{team.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="py-4 text-center text-sm font-bold text-muted">
              No team by that name.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
