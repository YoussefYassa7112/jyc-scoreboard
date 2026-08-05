"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { useTheme } from "@/lib/theme";
import type { StandingRow } from "@/lib/standings";

type Props = {
  standings: StandingRow[];
};

const PLANET_R = 14;
const CORE_R = 26;
const LEVEL_GAP = 34;
const PAD = 44;

type OrbitNode = StandingRow & {
  level: number;
  orbit: number;
  angle: number;
  speed: number;
};

/**
 * Quantum orbit arena — continuous revolution.
 * One ring per distinct score; tied teams share an orbit.
 * Higher score => closer to Camp. Arena grows with unique scores.
 */
export function OrbitArena({ standings }: Props) {
  const { theme } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(
    null,
  );
  const nodesRef = useRef<OrbitNode[]>([]);
  const clockOrigin = useRef(performance.now());

  const dataKey = useMemo(
    () =>
      standings
        .map((t) => `${t.id}:${t.score}:${t.name}:${t.color}`)
        .sort()
        .join("|"),
    [standings],
  );

  // Build / rebuild geometry when team data or theme changes
  useEffect(() => {
    const svgEl = svgRef.current;
    const wrap = wrapRef.current;
    if (!svgEl || !wrap) return;

    const svg = d3.select(svgEl);
    const teams = [...standings].sort(
      (a, b) => b.score - a.score || a.name.localeCompare(b.name),
    );

    // One orbit per distinct score (ties share a ring)
    const uniqueScores = Array.from(new Set(teams.map((t) => t.score))).sort(
      (a, b) => b - a,
    );
    const orbitCount = Math.max(uniqueScores.length, 1);
    const maxOrbit = CORE_R + 16 + orbitCount * LEVEL_GAP;
    const size = Math.max(220, maxOrbit * 2 + PAD * 2);

    svg
      .attr("viewBox", `0 0 ${size} ${size}`)
      .attr("width", size)
      .attr("height", size)
      .attr("preserveAspectRatio", "xMidYMid meet");

    svg.selectAll("*").remove();

    const ringStroke =
      theme === "dark" ? "rgba(148,163,184,0.35)" : "rgba(92,64,51,0.22)";
    const labelFill = theme === "dark" ? "#e2e8f0" : "#2a1f14";
    const emptyFill = theme === "dark" ? "#cbd5e1" : "#5c4033";
    const qFill =
      theme === "dark" ? "rgba(186,198,214,0.7)" : "rgba(92,64,51,0.45)";

    if (teams.length === 0) {
      gRef.current = null;
      nodesRef.current = [];
      svg
        .append("text")
        .attr("x", size / 2)
        .attr("y", size / 2)
        .attr("text-anchor", "middle")
        .attr("fill", emptyFill)
        .attr("font-size", 14)
        .attr("font-weight", 700)
        .text("Add teams to power up the orbit arena");
      return;
    }

    const g = svg
      .append("g")
      .attr("transform", `translate(${size / 2},${size / 2})`);
    gRef.current = g;

    const orbitForLevel = (level: number) => CORE_R + 16 + level * LEVEL_GAP;
    const levelByScore = new Map(
      uniqueScores.map((score, idx) => [score, idx + 1]),
    );

    // Draw only rings that currently have a score level
    uniqueScores.forEach((score, idx) => {
      const level = idx + 1;
      const r = orbitForLevel(level);
      g.append("circle")
        .attr("r", r)
        .attr("fill", "none")
        .attr("stroke", ringStroke)
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", level === 1 ? "0" : "4 7");
      g.append("text")
        .attr("x", 0)
        .attr("y", -r + 3)
        .attr("text-anchor", "middle")
        .attr("fill", qFill)
        .attr("font-size", 9)
        .attr("font-weight", 700)
        .text(`${score} pts`);
    });

    const core = g.append("g");
    core
      .append("circle")
      .attr("r", CORE_R + 8)
      .attr("fill", "none")
      .attr("stroke", theme === "dark" ? "#38bdf8" : "#e8b923")
      .attr("stroke-width", 2)
      .attr("opacity", 0.75);
    core
      .append("circle")
      .attr("r", CORE_R)
      .attr("fill", theme === "dark" ? "#1d4ed8" : "#c45c26");
    core
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#fff8ee")
      .attr("font-size", 12)
      .attr("font-weight", 800)
      .text("CAMP");

    // Spread teammates evenly around their shared orbit
    const slotByScore = new Map<number, number>();
    const countByScore = new Map<number, number>();
    for (const team of teams) {
      countByScore.set(team.score, (countByScore.get(team.score) ?? 0) + 1);
    }

    const nodes: OrbitNode[] = teams.map((team) => {
      const level = levelByScore.get(team.score) ?? 1;
      const slot = slotByScore.get(team.score) ?? 0;
      slotByScore.set(team.score, slot + 1);
      const onOrbit = countByScore.get(team.score) ?? 1;
      // Offset each ring a bit so stacked orbits don't line up perfectly
      const phase = (level - 1) * 0.35;
      return {
        ...team,
        level,
        orbit: orbitForLevel(level),
        angle: phase + (slot / onOrbit) * Math.PI * 2,
        // Inner (higher score) orbits move a touch faster
        speed: 0.28 + (orbitCount - level + 1) * 0.045,
      };
    });
    nodesRef.current = nodes;

    const planet = g
      .selectAll<SVGGElement, OrbitNode>("g.planet")
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const pg = enter.append("g").attr("class", "planet");
        pg.append("circle").attr("class", "glow");
        pg.append("circle").attr("class", "body");
        pg.append("text").attr("class", "score");
        pg.append("text").attr("class", "label");
        return pg;
      });

    planet
      .select("circle.glow")
      .attr("r", PLANET_R + 5)
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.28);
    planet
      .select("circle.body")
      .attr("r", PLANET_R)
      .attr("fill", (d) => d.color)
      .attr("stroke", "#fff8ee")
      .attr("stroke-width", 2);
    planet
      .select("text.score")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#fff8ee")
      .attr("font-size", 10)
      .attr("font-weight", 800)
      .attr("paint-order", "stroke")
      .attr("stroke", "rgba(0,0,0,0.35)")
      .attr("stroke-width", 2)
      .text((d) => String(d.score));
    planet
      .select("text.label")
      .attr("text-anchor", "middle")
      .attr("dy", PLANET_R + 14)
      .attr("fill", labelFill)
      .attr("font-size", 11)
      .attr("font-weight", 800)
      .text((d) => (d.name.length > 12 ? `${d.name.slice(0, 11)}…` : d.name));
    // dataKey captures standings content; avoid rebuild on every poll reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, theme]);

  // Continuous spin — never resets when standings poll refreshes
  useEffect(() => {
    const timer = d3.timer(() => {
      const g = gRef.current;
      const nodes = nodesRef.current;
      if (!g || nodes.length === 0) return;

      const t = (performance.now() - clockOrigin.current) / 1000;
      g.selectAll<SVGGElement, OrbitNode>("g.planet").attr(
        "transform",
        (d) => {
          const a = d.angle + t * d.speed;
          return `translate(${Math.cos(a) * d.orbit},${Math.sin(a) * d.orbit})`;
        },
      );
    });

    return () => {
      timer.stop();
    };
  }, []);

  return (
    <section className="panel toy-box relative overflow-visible rounded-3xl p-3 sm:p-5">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="display-font text-xs font-semibold uppercase tracking-[0.22em] text-muted-soft">
            D3 quantum orbits
          </p>
          <h2 className="display-font text-xl font-bold text-ink sm:text-2xl">
            Team constellation
          </h2>
        </div>
        <p className="text-xs font-bold text-muted-soft">
          One orbit per score · ties share a ring · closer = ahead
        </p>
      </div>
      <div ref={wrapRef} className="flex w-full justify-center overflow-visible">
        <svg ref={svgRef} className="block max-w-full overflow-visible" />
      </div>
    </section>
  );
}
