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
const THEME_MS = 160;

type OrbitChrome = {
  ringStroke: string;
  ringFill: string;
  labelFill: string;
  emptyFill: string;
  qFill: string;
  coreHot: string;
  coreInner: string;
  coreOuter: string;
  leaderRing: string;
  campInk: string;
  campHalo: string;
  skyFill: string;
  starFill: string;
  leaderStroke: string;
};

function applyOrbitTheme(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  scene: Scene,
  chrome: OrbitChrome,
) {
  const {
    ringStroke,
    ringFill,
    labelFill,
    emptyFill,
    qFill,
    coreHot,
    coreInner,
    coreOuter,
    leaderRing,
    campInk,
    campHalo,
    skyFill,
    starFill,
    leaderStroke,
  } = chrome;

  ensureDefs(svg, coreHot, coreInner, coreOuter);
  paintStars(scene.stars, 0, starFill);
  paintCore(scene.core, coreOuter, campInk, campHalo);

  const sky = scene.world.select("circle.sky");
  if (!sky.empty() && sky.attr("fill")) {
    sky
      .transition("theme")
      .duration(THEME_MS)
      .ease(d3.easeCubicOut)
      .attr("fill", skyFill);
  }

  scene.rings
    .selectAll("circle.halo")
    .transition("theme")
    .duration(THEME_MS)
    .ease(d3.easeCubicOut)
    .attr("fill", ringFill);
  scene.rings
    .selectAll<SVGCircleElement, { level: number }>("circle.track")
    .transition("theme")
    .duration(THEME_MS)
    .ease(d3.easeCubicOut)
    .attr("stroke", (d) => (d?.level === 1 ? leaderStroke : ringStroke));
  scene.rings
    .selectAll<SVGCircleElement, { level: number }>("circle.drift")
    .transition("theme")
    .duration(THEME_MS)
    .ease(d3.easeCubicOut)
    .attr("stroke", (d) => (d?.level === 1 ? leaderStroke : ringStroke));
  scene.rings
    .selectAll("text.pts")
    .transition("theme")
    .duration(THEME_MS)
    .ease(d3.easeCubicOut)
    .attr("fill", qFill);

  scene.planets
    .selectAll<SVGGElement, { level: number }>("g.planet")
    .select("circle.body")
    .transition("theme")
    .duration(THEME_MS)
    .ease(d3.easeCubicOut)
    .attr("stroke", (d) => (d?.level === 1 ? leaderRing : "#fff8ee"));
  scene.planets
    .selectAll("text.label")
    .transition("theme")
    .duration(THEME_MS)
    .ease(d3.easeCubicOut)
    .attr("fill", labelFill);

  svg
    .selectAll("text.empty-orbit")
    .transition("theme")
    .duration(THEME_MS)
    .ease(d3.easeCubicOut)
    .attr("fill", emptyFill);
}

function orbitChrome(dark: boolean): OrbitChrome {
  if (dark) {
    // Night: Buzz cyan on navy.
    return {
      ringStroke: "rgba(148,163,184,0.42)",
      ringFill: "rgba(56,189,248,0.07)",
      labelFill: "#e2e8f0",
      emptyFill: "#cbd5e1",
      qFill: "rgba(186,198,214,0.72)",
      coreHot: "#7dd3fc",
      coreInner: "#1d4ed8",
      coreOuter: "#38bdf8",
      leaderRing: "#f5d76e",
      campInk: "#fff8ee",
      campHalo: "#0b1224",
      skyFill: "rgba(15,23,42,0.35)",
      starFill: "#e2e8f0",
      leaderStroke: "#f5d76e",
    };
  }
  // Day: light apricot — readable on cream without the harsh pumpkin.
  return {
    ringStroke: "rgba(224,154,82,0.5)",
    ringFill: "rgba(244,197,138,0.16)",
    labelFill: "#9a5b2a",
    emptyFill: "#d4924a",
    qFill: "rgba(201,132,64,0.78)",
    coreHot: "#fff8e1",
    coreInner: "#f4d35e",
    coreOuter: "#f0b15b",
    leaderRing: "#f4d35e",
    campInk: "#fff8ee",
    campHalo: "#e09a4a",
    skyFill: "rgba(244,197,138,0.14)",
    starFill: "#e8b55a",
    leaderStroke: "#e09a4a",
  };
}

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

interface Scene {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  world: d3.Selection<SVGGElement, unknown, null, undefined>;
  stars: d3.Selection<SVGGElement, unknown, null, undefined>;
  rings: d3.Selection<SVGGElement, unknown, null, undefined>;
  core: d3.Selection<SVGGElement, unknown, null, undefined>;
  planets: d3.Selection<SVGGElement, unknown, null, undefined>;
}

/**
 * Element handles collected once per data change. The frame loop writes straight
 * to these instead of building d3 selections 60 times a second.
 */
type PlanetHandle = {
  node: OrbitNode;
  g: SVGGElement;
  wake: SVGCircleElement | null;
  glow: SVGCircleElement | null;
  body: SVGCircleElement | null;
  label: SVGTextElement | null;
};

type DriftHandle = { el: SVGCircleElement; level: number };
type StarHandle = { el: SVGCircleElement; twinkle: number };

/** Ambient twinkle/drift refresh rate. Planets still move every frame. */
const AMBIENT_MS = 1000 / 30;

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
  const planetsRef = useRef<PlanetHandle[]>([]);
  const driftRef = useRef<DriftHandle[]>([]);
  const starsRef = useRef<StarHandle[]>([]);
  const haloRef = useRef<SVGCircleElement | null>(null);
  const sizeRef = useRef({ current: 220, target: 220 });
  const viewBoxRef = useRef("");
  const visibleRef = useRef(false);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // A hidden tab still holds this component mounted, so gate the loop on real
  // visibility instead of letting it churn behind `display: none`.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new IntersectionObserver(
      (entries) => {
        visibleRef.current = entries.some((entry) => entry.isIntersecting);
      },
      { rootMargin: "64px" },
    );
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

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

    const chrome = orbitChrome(themeRef.current === "dark");
    const {
      ringStroke,
      ringFill,
      labelFill,
      emptyFill,
      qFill,
      coreHot,
      coreInner,
      coreOuter,
      leaderRing,
      campInk,
      campHalo,
      skyFill,
      starFill,
      leaderStroke,
    } = chrome;

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
    if (!viewBoxRef.current) {
      const first = sizeRef.current.current;
      viewBoxRef.current = `0 0 ${first.toFixed(1)} ${first.toFixed(1)}`;
      svg.attr("viewBox", viewBoxRef.current);
      scene.world.attr(
        "transform",
        `translate(${(first / 2).toFixed(1)},${(first / 2).toFixed(1)})`,
      );
    }

    const sky = scene.world.select("circle.sky").attr("r", maxOrbit + 28);
    if (!sky.attr("fill")) sky.attr("fill", skyFill);

    paintStars(scene.stars, maxOrbit + 20, starFill);
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
    ringMerge
      .select("circle.halo")
      .attr("fill", ringFill)
      .transition("rank")
      .duration(RANK_MOVE_MS)
      .ease(d3.easeCubicInOut)
      .attr("r", (d) => d.r);
    ringMerge
      .select("circle.track")
      .attr("stroke-dasharray", null)
      .attr("opacity", (d) => (d.level === 1 ? 0.9 : 0.5))
      .attr("stroke", (d) => (d.level === 1 ? leaderStroke : ringStroke))
      .attr("stroke-width", (d) => (d.level === 1 ? 2.2 : 1.35));
    ringMerge
      .select("circle.track")
      .transition("rank")
      .duration(RANK_MOVE_MS)
      .ease(d3.easeCubicInOut)
      .attr("r", (d) => d.r);
    ringMerge
      .select("circle.drift")
      .attr("stroke-width", 1.7)
      .attr("opacity", 0.75)
      .attr(
        "stroke-dasharray",
        (d) => `${Math.max(16, d.r * 0.18)} ${Math.max(26, d.r * 0.42)}`,
      )
      .attr("stroke", (d) => (d.level === 1 ? leaderStroke : ringStroke));
    ringMerge
      .select("circle.drift")
      .transition("rank")
      .duration(RANK_MOVE_MS)
      .ease(d3.easeCubicInOut)
      .attr("r", (d) => d.r);
    ringMerge
      .select("text.pts")
      .text((d) => `${d.score} pts`)
      .attr("fill", qFill);
    ringMerge
      .select("text.pts")
      .transition("rank")
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
      .attr("stroke-width", (d) => (d.level === 1 ? 3.5 : 2))
      .attr("stroke", (d) => (d.level === 1 ? leaderRing : "#fff8ee"));
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
      .attr("font-weight", 800)
      .attr("font-size", variant === "stage" ? 14 : 11)
      .text((d) => {
        const cap = variant === "stage" ? 18 : 16;
        return d.name.length > cap ? `${d.name.slice(0, cap - 1)}…` : d.name;
      })
      .attr("fill", labelFill);

    planet
      .exit()
      .transition()
      .duration(900)
      .attr("opacity", 0)
      .remove();

    const planetHandles: PlanetHandle[] = [];
    merge.each(function (d) {
      if (!d) return;
      planetHandles.push({
        node: d,
        g: this,
        wake: this.querySelector<SVGCircleElement>("circle.wake"),
        glow: this.querySelector<SVGCircleElement>("circle.glow"),
        body: this.querySelector<SVGCircleElement>("circle.body"),
        label: this.querySelector<SVGTextElement>("text.label"),
      });
    });
    planetsRef.current = planetHandles;

    const driftHandles: DriftHandle[] = [];
    ringMerge.each(function (d) {
      const el = this.querySelector<SVGCircleElement>("circle.drift");
      if (el && d) driftHandles.push({ el, level: d.level });
    });
    driftRef.current = driftHandles;

    const starHandles: StarHandle[] = [];
    scene.stars
      .selectAll<SVGCircleElement, { twinkle: number }>("circle.star")
      .each(function (d) {
        starHandles.push({ el: this, twinkle: d?.twinkle ?? 0 });
      });
    starsRef.current = starHandles;

    haloRef.current = scene.core
      .select<SVGCircleElement>("circle.halo")
      .node();
    // dataKey captures standings content; theme is painted in a separate lerp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, variant]);

  useEffect(() => {
    const svgEl = svgRef.current;
    const scene = sceneRef.current;
    if (!svgEl || !scene) return;
    applyOrbitTheme(d3.select(svgEl), scene, orbitChrome(theme === "dark"));
  }, [theme]);

  useEffect(() => {
    let last = performance.now();
    let frame = 0;
    let alive = true;
    let elapsed = 0;
    let lastAmbient = 0;

    function spin(now: number) {
      if (!alive) return;
      frame = window.requestAnimationFrame(spin);

      // Parked: no work at all while off screen or backgrounded.
      if (document.hidden || !visibleRef.current) {
        last = now;
        return;
      }

      const scene = sceneRef.current;
      if (!scene) return;

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      const t = elapsed;
      const ease = 1 - Math.exp(-dt * ORBIT_EASE);

      const sizeState = sizeRef.current;
      if (Math.abs(sizeState.target - sizeState.current) > 0.25) {
        sizeState.current += (sizeState.target - sizeState.current) * ease;
        if (Math.abs(sizeState.target - sizeState.current) <= 0.25) {
          sizeState.current = sizeState.target;
        }
        const size = sizeState.current;
        const viewBox = `0 0 ${size.toFixed(1)} ${size.toFixed(1)}`;
        if (viewBox !== viewBoxRef.current) {
          viewBoxRef.current = viewBox;
          const svgEl = scene.svg.node();
          svgEl?.setAttribute("viewBox", viewBox);
          scene.world
            .node()
            ?.setAttribute(
              "transform",
              `translate(${(size / 2).toFixed(1)},${(size / 2).toFixed(1)})`,
            );
        }
      }

      if (now - lastAmbient >= AMBIENT_MS) {
        lastAmbient = now;
        const halo = haloRef.current;
        if (halo) {
          const pulse = Math.sin(t * 1.7);
          halo.setAttribute("r", String(CORE_R + 11 + pulse * 3.5));
          halo.setAttribute("opacity", String(0.42 + pulse * 0.16));
        }
        for (const star of starsRef.current) {
          const alpha =
            0.18 + (0.45 + 0.35 * Math.sin(t * 1.4 + star.twinkle)) * 0.55;
          star.el.setAttribute("opacity", alpha.toFixed(3));
        }
        for (const drift of driftRef.current) {
          const dir = drift.level % 2 === 0 ? 1 : -1;
          drift.el.setAttribute(
            "stroke-dashoffset",
            (dir * t * (14 + drift.level * 5)).toFixed(1),
          );
        }
      }

      const planets = planetsRef.current;
      if (planets.length === 0) return;

      for (const handle of planets) {
        const d = handle.node;
        d.orbit += (d.targetOrbit - d.orbit) * ease;
        d.speed += (d.targetSpeed - d.speed) * ease;
        d.bodyR += (d.targetBodyR - d.bodyR) * ease;
        d.angle += d.speed * dt;

        const x = Math.cos(d.angle) * d.orbit;
        const y = Math.sin(d.angle) * d.orbit;
        handle.g.setAttribute(
          "transform",
          `translate(${x.toFixed(2)},${y.toFixed(2)})`,
        );
        handle.wake?.setAttribute("r", (d.bodyR + 11).toFixed(2));
        handle.glow?.setAttribute("r", (d.bodyR + 6).toFixed(2));
        handle.body?.setAttribute("r", d.bodyR.toFixed(2));
        handle.label?.setAttribute("dy", (d.bodyR + 14).toFixed(2));
      }
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
          ? "h-auto min-h-0 min-w-0 overflow-hidden p-2 sm:p-3 md:h-full"
          : "overflow-hidden p-3 sm:p-5"
      }`}
    >
      {/* Stage sizing is width-driven, never a fixed w-96: a fixed width sets the
          grid track's minimum and pushes the card past a narrow phone. */}
      <div
        ref={wrapRef}
        className={
          stage
            ? "relative mx-auto aspect-square min-h-0 w-full max-h-[46dvh] md:aspect-auto md:h-auto md:max-h-none md:flex-1"
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
        <div className="mt-3 shrink-0 border-t border-saddle/10 pt-3">
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
    const grad = defs.append("radialGradient").attr("id", "camp-core");
    grad.append("stop").attr("class", "core-inner").attr("offset", "0%");
    grad.append("stop").attr("class", "core-mid").attr("offset", "55%");
    grad.append("stop").attr("class", "core-outer").attr("offset", "100%");
  }
  const innerStop = defs.select("stop.core-inner");
  const painted = Boolean(innerStop.attr("stop-color"));
  const paintStop = (cls: string, color: string) => {
    const sel = defs.select(`stop.${cls}`);
    if (!painted) {
      sel.attr("stop-color", color);
      return;
    }
    sel
      .transition("theme")
      .duration(THEME_MS)
      .ease(d3.easeCubicOut)
      .attr("stop-color", color);
  };
  paintStop("core-inner", hot);
  paintStop("core-mid", inner);
  paintStop("core-outer", outer);
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
  fill: string,
) {
  if (!stars.select("circle.star").empty()) {
    stars
      .selectAll("circle.star")
      .transition("theme")
      .duration(THEME_MS)
      .ease(d3.easeCubicOut)
      .attr("fill", fill);
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
    .attr("fill", fill)
    .attr("opacity", 0.45);
}

function paintCore(
  core: d3.Selection<SVGGElement, unknown, null, undefined>,
  haloStroke: string,
  campInk: string,
  campHalo: string,
) {
  if (core.select("circle.body").empty()) {
    // No SVG blur filter here on purpose: the halo's radius pulses every frame,
    // and a filtered element re-rasterises on every one of those writes.
    core
      .append("circle")
      .attr("class", "halo")
      .attr("fill", "none")
      .attr("stroke-width", 3.4);
    core.append("circle").attr("class", "body").attr("r", CORE_R);
    core
      .append("text")
      .attr("class", "camp-label")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", 14)
      .attr("font-weight", 800)
      .attr("paint-order", "stroke")
      .attr("stroke-linejoin", "round")
      .attr("stroke-width", 3.5)
      .text("JYC");
  }
  core
    .select("circle.halo")
    .transition("theme")
    .duration(THEME_MS)
    .ease(d3.easeCubicOut)
    .attr("stroke", haloStroke);
  core.select("circle.body").attr("fill", "url(#camp-core)");
  core
    .select("text.camp-label")
    .transition("theme")
    .duration(THEME_MS)
    .ease(d3.easeCubicOut)
    .attr("fill", campInk)
    .attr("stroke", campHalo);
}
