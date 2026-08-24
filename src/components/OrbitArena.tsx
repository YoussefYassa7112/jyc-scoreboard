"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as d3 from "d3";
import { useTheme } from "@/lib/theme";
import type { StandingRow } from "@/lib/standings";

type Props = {
  standings: StandingRow[];
  /** `stage` fills the pane so every orbit stays on screen. */
  variant?: "board" | "stage";
  children?: ReactNode;
};

const PLANET_R = 14;
const LEADER_R = 18;
const CORE_R = 26;
const LEVEL_GAP = 36;
const PAD = 48;
/** Lower = slower radius lerp when ranks/scores change. */
const ORBIT_EASE = 1.15;
const RANK_MOVE_MS = 1800;

type OrbitNode = StandingRow & {
  level: number;
  orbit: number;
  targetOrbit: number;
  angle: number;
  speed: number;
  targetSpeed: number;
  bodyR: number;
  targetBodyR: number;
};

type Scene = {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  world: d3.Selection<SVGGElement, unknown, null, undefined>;
  stars: d3.Selection<SVGGElement, unknown, null, undefined>;
  rings: d3.Selection<SVGGElement, unknown, null, undefined>;
  core: d3.Selection<SVGGElement, unknown, null, undefined>;
  planets: d3.Selection<SVGGElement, unknown, null, undefined>;
};

/**
 * Quantum orbit arena — continuous revolution.
 * One ring per distinct score; tied teams share an orbit.
 * Higher score => closer to Camp. Arena grows with unique scores.
 * Rank/score changes lerp radius instead of wiping the SVG.
 */
export function OrbitArena({ standings, variant = "board", children }: Props) {
  const { theme } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const nodesRef = useRef<OrbitNode[]>([]);
  const sizeRef = useRef({ current: 220, target: 220 });
  const clockOrigin = useRef(performance.now());

  const dataKey = useMemo(
    () =>
      standings
        .map((t) => `${t.id}:${t.score}:${t.name}:${t.color}`)
        .sort()
        .join("|"),
    [standings],
  );

  useEffect(() => {
    const svgEl = svgRef.current;
    const wrap = wrapRef.current;
    if (!svgEl || !wrap) return;

    const svg = d3.select(svgEl);
    const teams = [...standings].sort(
      (a, b) => b.score - a.score || a.name.localeCompare(b.name),
    );

    const uniqueScores = Array.from(new Set(teams.map((t) => t.score))).sort(
      (a, b) => b - a,
    );
    const orbitCount = Math.max(uniqueScores.length, 1);
    const gap = variant === "stage" ? 42 : LEVEL_GAP;
    const pad = variant === "stage" ? 80 : PAD;
    const maxOrbit = CORE_R + 16 + orbitCount * gap;
    const size = Math.max(240, maxOrbit * 2 + pad * 2);
    sizeRef.current.target = size;

    const dark = theme === "dark";
    const ringStroke = dark ? "rgba(148,163,184,0.38)" : "rgba(92,64,51,0.2)";
    const ringFill = dark ? "rgba(56,189,248,0.045)" : "rgba(232,185,35,0.05)";
    const labelFill = dark ? "#e2e8f0" : "#2a1f14";
    const emptyFill = dark ? "#cbd5e1" : "#5c4033";
    const qFill = dark ? "rgba(186,198,214,0.72)" : "rgba(92,64,51,0.42)";
    const coreHot = dark ? "#7dd3fc" : "#f4d35e";
    const coreInner = dark ? "#1d4ed8" : "#c45c26";
    const coreOuter = dark ? "#38bdf8" : "#e8b923";
    const leaderRing = dark ? "#f5d76e" : "#c9a227";
    const campInk = dark ? "#fff8ee" : "#2a1f14";
    const campHalo = dark ? "#0b1224" : "#fff4d0";
    const skyFill = dark ? "rgba(15,23,42,0.35)" : "rgba(255,248,238,0.35)";

    ensureDefs(svg, coreHot, coreInner, coreOuter);
    const scene = ensureScene(svg);
    sceneRef.current = scene;

    if (teams.length === 0) {
      nodesRef.current = [];
      scene.rings.selectAll("*").remove();
      scene.planets.selectAll("*").remove();
      scene.core.selectAll("*").remove();
      scene.stars.selectAll("*").remove();
      svg.selectAll("text.empty-orbit").remove();
      svg
        .append("text")
        .attr("class", "empty-orbit")
        .attr("x", size / 2)
        .attr("y", size / 2)
        .attr("text-anchor", "middle")
        .attr("fill", emptyFill)
        .attr("font-size", 14)
        .attr("font-weight", 700)
        .text("Add teams to power up the orbit arena");
      svg
        .attr("viewBox", `0 0 ${size} ${size}`)
        .attr("preserveAspectRatio", "xMidYMid meet");
      sizeRef.current.current = size;
      return;
    }

    svg.selectAll("text.empty-orbit").remove();
    if (sizeRef.current.current < 2) sizeRef.current.current = size;
    svg.attr("preserveAspectRatio", "xMidYMid meet");

    scene.world
      .select("circle.sky")
      .attr("r", maxOrbit + 28)
      .attr("fill", skyFill);

    paintStars(scene.stars, maxOrbit + 20, dark);
    paintCore(scene.core, coreOuter, campInk, campHalo);

    const orbitForLevel = (level: number) => CORE_R + 16 + level * gap;
    const levelByScore = new Map(
      uniqueScores.map((score, idx) => [score, idx + 1]),
    );

    const ringData = uniqueScores.map((score, idx) => {
      const level = idx + 1;
      return { score, level, r: orbitForLevel(level) };
    });

    const ring = scene.rings
      .selectAll<SVGGElement, (typeof ringData)[number]>("g.ring")
      .data(ringData, (d) => String(d.level));

    const ringEnter = ring.enter().append("g").attr("class", "ring");
    ringEnter.append("circle").attr("class", "halo").attr("fill", ringFill);
    ringEnter
      .append("circle")
      .attr("class", "track")
      .attr("fill", "none")
      .attr("stroke-linecap", "round");
    ringEnter
      .append("circle")
      .attr("class", "drift")
      .attr("fill", "none")
      .attr("stroke-linecap", "round");
    ringEnter
      .append("text")
      .attr("class", "pts")
      .attr("text-anchor", "middle")
      .attr("font-size", 9)
      .attr("font-weight", 700);

    const ringMerge = ringEnter.merge(ring);
    ringMerge.each(function () {
      const g = d3.select(this);
      if (g.select("circle.drift").empty()) {
        g.insert("circle", "text.pts")
          .attr("class", "drift")
          .attr("fill", "none")
          .attr("stroke-linecap", "round");
      }
    });
    const leaderStroke = dark ? "#f5d76e" : "#c9a227";
    ringMerge
      .select("circle.halo")
      .transition()
      .duration(RANK_MOVE_MS)
      .ease(d3.easeCubicInOut)
      .attr("r", (d) => d.r)
      .attr("fill", ringFill);
    ringMerge
      .select("circle.track")
      .attr("stroke", (d) => (d.level === 1 ? leaderStroke : ringStroke))
      .attr("stroke-width", (d) => (d.level === 1 ? 2.2 : 1.35))
      .attr("stroke-dasharray", null)
      .attr("opacity", (d) => (d.level === 1 ? 0.9 : 0.5))
      .transition()
      .duration(RANK_MOVE_MS)
      .ease(d3.easeCubicInOut)
      .attr("r", (d) => d.r);
    ringMerge
      .select("circle.drift")
      .attr("stroke", (d) => (d.level === 1 ? leaderStroke : ringStroke))
      .attr("stroke-width", 1.7)
      .attr("opacity", 0.75)
      .attr(
        "stroke-dasharray",
        (d) => `${Math.max(16, d.r * 0.18)} ${Math.max(26, d.r * 0.42)}`,
      )
      .transition()
      .duration(RANK_MOVE_MS)
      .ease(d3.easeCubicInOut)
      .attr("r", (d) => d.r);
    ringMerge
      .select("text.pts")
      .attr("fill", qFill)
      .text((d) => `${d.score} pts`)
      .transition()
      .duration(RANK_MOVE_MS)
      .ease(d3.easeCubicInOut)
      .attr("y", (d) => -d.r + 3);
    ring.exit().transition().duration(900).style("opacity", 0).remove();

    const slotByScore = new Map<number, number>();
    const countByScore = new Map<number, number>();
    for (const team of teams) {
      countByScore.set(team.score, (countByScore.get(team.score) ?? 0) + 1);
    }

    const prevById = new Map(nodesRef.current.map((node) => [node.id, node]));
    const nodes: OrbitNode[] = teams.map((team) => {
      const level = levelByScore.get(team.score) ?? 1;
      const slot = slotByScore.get(team.score) ?? 0;
      slotByScore.set(team.score, slot + 1);
      const onOrbit = countByScore.get(team.score) ?? 1;
      const phase = (level - 1) * 0.35;
      const targetOrbit = orbitForLevel(level);
      const targetSpeed = 0.26 + (orbitCount - level + 1) * 0.048;
      const targetBodyR = level === 1 ? LEADER_R : PLANET_R;
      const prev = prevById.get(team.id);
      if (prev) {
        return {
          ...team,
          level,
          orbit: prev.orbit,
          targetOrbit,
          angle: prev.angle,
          speed: prev.speed,
          targetSpeed,
          bodyR: prev.bodyR,
          targetBodyR,
        };
      }
      return {
        ...team,
        level,
        orbit: targetOrbit * 0.35,
        targetOrbit,
        angle: phase + (slot / onOrbit) * Math.PI * 2,
        speed: targetSpeed,
        targetSpeed,
        bodyR: targetBodyR * 0.4,
        targetBodyR,
      };
    });
    nodesRef.current = nodes;

    const planet = scene.planets
      .selectAll<SVGGElement, OrbitNode>("g.planet")
      .data(nodes, (d) => String(d.id));

    const enter = planet.enter().append("g").attr("class", "planet").attr("opacity", 0);
    enter.append("circle").attr("class", "wake");
    enter.append("circle").attr("class", "glow");
    enter.append("circle").attr("class", "body");
    enter.append("text").attr("class", "score");
    enter.append("text").attr("class", "label");
    enter.transition().duration(800).attr("opacity", 1);

    const merge = enter.merge(planet);
    merge
      .select("circle.wake")
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.12);
    merge
      .select("circle.glow")
      .attr("fill", (d) => d.color)
      .attr("opacity", (d) => (d.level === 1 ? 0.42 : 0.26));
    merge
      .select("circle.body")
      .attr("fill", (d) => d.color)
      .attr("stroke", (d) => (d.level === 1 ? leaderRing : "#fff8ee"))
      .attr("stroke-width", (d) => (d.level === 1 ? 3.5 : 2));
    merge
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
    merge
      .select("text.label")
      .attr("text-anchor", "middle")
      .attr("fill", labelFill)
      .attr("font-weight", 800)
      .attr("font-size", variant === "stage" ? 14 : 11)
      .text((d) => {
        const cap = variant === "stage" ? 18 : 12;
        return d.name.length > cap ? `${d.name.slice(0, cap - 1)}…` : d.name;
      });

    planet
      .exit()
      .transition()
      .duration(900)
      .attr("opacity", 0)
      .remove();
    // dataKey captures standings content; avoid rebuild on every poll reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, theme, variant]);

  useEffect(() => {
    let last = performance.now();
    let frame = 0;
    let alive = true;

    function spin(now: number) {
      if (!alive) return;
      frame = window.requestAnimationFrame(spin);

      const scene = sceneRef.current;
      const nodes = nodesRef.current;
      if (!scene) return;

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - clockOrigin.current) / 1000;
      const ease = 1 - Math.exp(-dt * ORBIT_EASE);

      const sizeState = sizeRef.current;
      sizeState.current += (sizeState.target - sizeState.current) * ease;
      const size = sizeState.current;
      scene.svg
        .attr("viewBox", `0 0 ${size} ${size}`)
        .attr("preserveAspectRatio", "xMidYMid meet");
      scene.world.attr("transform", `translate(${size / 2},${size / 2})`);

      const halo = scene.core.select("circle.halo");
      if (!halo.empty()) {
        halo
          .attr("r", CORE_R + 11 + Math.sin(t * 1.7) * 3.5)
          .attr("opacity", 0.42 + Math.sin(t * 1.7) * 0.16);
      }
      scene.stars
        .selectAll<SVGCircleElement, { twinkle: number }>("circle.star")
        .attr(
          "opacity",
          (d) =>
            0.18 + (0.45 + 0.35 * Math.sin(t * 1.4 + d.twinkle)) * 0.55,
        );

      scene.rings
        .selectAll<SVGCircleElement, { level: number }>("circle.drift")
        .attr("stroke-dashoffset", (d) => {
          if (!d) return 0;
          const dir = d.level % 2 === 0 ? 1 : -1;
          return dir * t * (14 + d.level * 5);
        });

      if (nodes.length === 0) return;

      for (const node of nodes) {
        node.orbit += (node.targetOrbit - node.orbit) * ease;
        node.speed += (node.targetSpeed - node.speed) * ease;
        node.bodyR += (node.targetBodyR - node.bodyR) * ease;
      }

      scene.planets
        .selectAll<SVGGElement, OrbitNode>("g.planet")
        .each(function (d) {
          if (!d) return;
          const a = d.angle + t * d.speed;
          const x = Math.cos(a) * d.orbit;
          const y = Math.sin(a) * d.orbit;
          d3.select(this).attr("transform", `translate(${x},${y})`);
          d3.select(this).select("circle.wake").attr("r", d.bodyR + 11);
          d3.select(this).select("circle.glow").attr("r", d.bodyR + 6);
          d3.select(this).select("circle.body").attr("r", d.bodyR);
          d3.select(this)
            .select("text.label")
            .attr("dy", d.bodyR + 14);
        });
    }

    frame = window.requestAnimationFrame(spin);
    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const stage = variant === "stage";

  return (
    <section
      className={`panel toy-box relative flex flex-col rounded-3xl ${
        stage
          ? "h-auto min-h-0 p-2 sm:p-3 md:h-full md:overflow-hidden"
          : "overflow-hidden p-3 sm:p-5"
      }`}
    >
      <div
        ref={wrapRef}
        className={
          stage
            ? "relative mx-auto aspect-square h-96 w-96 max-h-[50dvh] max-w-full min-h-0 md:aspect-auto md:h-auto md:max-h-none md:w-full md:flex-1"
            : "mx-auto w-full max-w-lg overflow-hidden"
        }
      >
        <svg
          ref={svgRef}
          className={
            stage ? "block h-full w-full" : "block h-auto w-full"
          }
        />
      </div>
      {children ? (
        <div className="mt-3 shrink-0 border-t border-saddle/10 pt-3 dark:border-white/10">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function ensureDefs(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  hot: string,
  inner: string,
  outer: string,
) {
  let defs = svg.select<SVGDefsElement>("defs.orbit-defs");
  if (defs.empty()) {
    defs = svg.append("defs").attr("class", "orbit-defs");
    const glow = defs.append("filter").attr("id", "orbit-glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    glow.append("feGaussianBlur").attr("stdDeviation", 6).attr("result", "blur");
    glow
      .append("feMerge")
      .selectAll("feMergeNode")
      .data(["blur", "SourceGraphic"])
      .enter()
      .append("feMergeNode")
      .attr("in", (d) => d);

    const grad = defs.append("radialGradient").attr("id", "camp-core");
    grad.append("stop").attr("class", "core-inner").attr("offset", "0%");
    grad.append("stop").attr("class", "core-mid").attr("offset", "55%");
    grad.append("stop").attr("class", "core-outer").attr("offset", "100%");
  }
  defs.select("stop.core-inner").attr("stop-color", hot);
  defs.select("stop.core-mid").attr("stop-color", inner);
  defs.select("stop.core-outer").attr("stop-color", outer);
}

function ensureScene(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
): Scene {
  let world = svg.select<SVGGElement>("g.world");
  if (world.empty()) {
    world = svg.append("g").attr("class", "world");
    world.append("circle").attr("class", "sky").attr("cx", 0).attr("cy", 0);
    world.append("g").attr("class", "stars");
    world.append("g").attr("class", "rings");
    world.append("g").attr("class", "core");
    world.append("g").attr("class", "planets");
  }
  return {
    svg,
    world,
    stars: world.select("g.stars"),
    rings: world.select("g.rings"),
    core: world.select("g.core"),
    planets: world.select("g.planets"),
  };
}

function paintStars(
  stars: d3.Selection<SVGGElement, unknown, null, undefined>,
  radius: number,
  dark: boolean,
) {
  if (!stars.select("circle.star").empty()) {
    stars
      .selectAll("circle.star")
      .attr("fill", dark ? "#e2e8f0" : "#e8b923");
    return;
  }
  const dots = d3.range(28).map((i) => {
    const a = (i / 28) * Math.PI * 2 + (i % 5) * 0.21;
    const r = radius * (0.42 + ((i * 17) % 10) / 22);
    return {
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      twinkle: i * 0.7,
      size: i % 4 === 0 ? 1.8 : 1.15,
    };
  });
  stars
    .selectAll("circle.star")
    .data(dots)
    .enter()
    .append("circle")
    .attr("class", "star")
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", (d) => d.size)
    .attr("fill", dark ? "#e2e8f0" : "#e8b923")
    .attr("opacity", 0.35);
}

function paintCore(
  core: d3.Selection<SVGGElement, unknown, null, undefined>,
  haloStroke: string,
  campInk: string,
  campHalo: string,
) {
  if (core.select("circle.body").empty()) {
    core
      .append("circle")
      .attr("class", "halo")
      .attr("fill", "none")
      .attr("stroke-width", 2.4)
      .attr("filter", "url(#orbit-glow)");
    core.append("circle").attr("class", "body").attr("r", CORE_R).attr("filter", "url(#orbit-glow)");
    core
      .append("text")
      .attr("class", "camp-label")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", 14)
      .attr("font-weight", 800)
      .attr("paint-order", "stroke")
      .attr("stroke-linejoin", "round")
      .text("JYC");
  }
  core.select("circle.halo").attr("stroke", haloStroke);
  core.select("circle.body").attr("fill", "url(#camp-core)");
  core
    .select("text.camp-label")
    .attr("fill", campInk)
    .attr("stroke", campHalo)
    .attr("stroke-width", 3.5)
    .text("JYC");
}
