"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as d3 from "d3";
import { useTheme } from "@/lib/theme";

type TeamPoint = {
  id: number;
  name: string;
  color: string;
  score: number;
  eventCount?: number;
  rank?: number;
};

type Props = {
  teams: TeamPoint[];
};

type TipItem = {
  team: TeamPoint;
  rank: number;
};

type TipState = {
  x: number;
  y: number;
  items: TipItem[];
  focusId: number;
} | null;

type Pt = { x: number; y: number };

function polyString(points: Pt[]) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function dist(a: Pt, b: Pt) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/** Push overlapping dots apart so each stays hoverable. */
function separatePoints(points: Pt[], minDist: number, angles: number[]) {
  const out = points.map((p) => ({ ...p }));
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const d = dist(out[i], out[j]);
        if (d >= minDist || d < 0.001) {
          if (d >= minDist) continue;
          // Exact overlap: nudge along each axis angle
          const push = minDist / 2;
          out[i].x += Math.cos(angles[i]) * push;
          out[i].y += Math.sin(angles[i]) * push;
          out[j].x += Math.cos(angles[j]) * push;
          out[j].y += Math.sin(angles[j]) * push;
          continue;
        }
        const overlap = (minDist - d) / 2;
        const ux = (out[j].x - out[i].x) / d;
        const uy = (out[j].y - out[i].y) / d;
        out[i].x -= ux * overlap;
        out[i].y -= uy * overlap;
        out[j].x += ux * overlap;
        out[j].y += uy * overlap;
      }
    }
  }
  return out;
}

/**
 * Animated D3 radar chart with modern hover tooltips.
 * Low-score dots stay on their spokes (not stacked at center).
 */
export function SpiderChart({ teams }: Props) {
  const { theme } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const prevPts = useRef<Map<number, Pt>>(new Map());
  const hasPlayedIntro = useRef(false);
  const gridKeyRef = useRef("");
  const tipLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tip, setTip] = useState<TipState>(null);

  const sorted = useMemo(
    () =>
      [...teams]
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .map((t, i) => ({ ...t, rank: i + 1 })),
    [teams],
  );

  const dataKey = useMemo(
    () => sorted.map((t) => `${t.id}:${t.score}:${t.name}:${t.color}`).join("|"),
    [sorted],
  );

  function clearTipSoon() {
    if (tipLeaveTimer.current) clearTimeout(tipLeaveTimer.current);
    tipLeaveTimer.current = setTimeout(() => setTip(null), 160);
  }

  function keepTip() {
    if (tipLeaveTimer.current) {
      clearTimeout(tipLeaveTimer.current);
      tipLeaveTimer.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (tipLeaveTimer.current) clearTimeout(tipLeaveTimer.current);
    };
  }, []);

  useEffect(() => {
    const wrapEl = wrapRef.current;
    const svgEl = svgRef.current;
    if (!wrapEl || !svgEl) return;
    // Capture after null-check so nested handlers keep a definite type
    const wrap: HTMLDivElement = wrapEl;

    const width = Math.min(wrap.clientWidth || 480, 520);
    const height = Math.max(300, Math.min(380, width));
    const svg = d3.select(svgEl);
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);

    const emptyFill = theme === "dark" ? "#94a3b8" : "#5c4033";
    if (sorted.length === 0) {
      svg.selectAll("*").remove();
      prevPts.current = new Map();
      hasPlayedIntro.current = false;
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", emptyFill)
        .attr("font-weight", 700)
        .text("Create teams to see the spider graph");
      return;
    }

    const cx = width / 2;
    const cy = height / 2 - 4;
    const radius = Math.min(width, height) / 2 - 48;
    const maxScore = Math.max(d3.max(sorted, (d) => d.score) ?? 1, 1);
    const angleSlice = (Math.PI * 2) / sorted.length;
    const levels = 4;
    // Keep zero/low scores off the exact center so dots don't stack
    const innerPad = Math.max(18, Math.min(28, radius * 0.16));
    const clusterDist = 22;

    const gridStroke =
      theme === "dark" ? "rgba(148,163,184,0.28)" : "rgba(92,64,51,0.18)";
    const labelFill = theme === "dark" ? "#e2e8f0" : "#2a1f14";
    const fillPoly =
      theme === "dark" ? "rgba(184,224,98,0.22)" : "rgba(107,66,38,0.2)";
    const strokePoly = theme === "dark" ? "#B8E062" : "#6B4226";
    const themeMs = 160;

    const angles = sorted.map((_, i) => i * angleSlice - Math.PI / 2);

    const rawPts: Pt[] = sorted.map((team, i) => {
      const a = angles[i];
      const r =
        (Math.max(team.score, 0) / maxScore) * (radius - innerPad) + innerPad;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });

    const targetPts = separatePoints(rawPts, 16, angles);

    const playIntro = !hasPlayedIntro.current;
    hasPlayedIntro.current = true;

    let root = svg.select<SVGGElement>("g.spider-root");
    if (root.empty()) {
      root = svg.append("g").attr("class", "spider-root");
    }
    root.attr("transform", `translate(${cx},${cy})`);

    let grid = root.select<SVGGElement>("g.grid");
    if (grid.empty()) grid = root.append("g").attr("class", "grid");
    const nextGridKey = `${sorted.length}:${width}:${height}`;
    const rebuildGrid = gridKeyRef.current !== nextGridKey;
    gridKeyRef.current = nextGridKey;

    if (rebuildGrid) {
    grid.selectAll("*").remove();

    d3.range(1, levels + 1).forEach((level) => {
      const r = (radius / levels) * level;
      const ring = sorted.map((_, i) => {
        const a = angles[i];
        return `${Math.cos(a) * r},${Math.sin(a) * r}`;
      });
      grid
        .append("polygon")
        .attr("points", ring.join(" "))
        .attr("fill", "none")
        .attr("stroke", gridStroke)
        .attr("stroke-width", 1)
        .attr("opacity", playIntro ? 0 : 1)
        .transition()
        .delay(playIntro ? level * 70 : 0)
        .duration(playIntro ? 500 : 200)
        .attr("opacity", 1);
    });

    sorted.forEach((_, i) => {
      const a = angles[i];
      grid
        .append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", Math.cos(a) * radius)
        .attr("y2", Math.sin(a) * radius)
        .attr("stroke", gridStroke)
        .attr("stroke-width", 1)
        .attr("opacity", playIntro ? 0 : 1)
        .transition()
        .delay(playIntro ? 120 + i * 40 : 0)
        .duration(playIntro ? 450 : 200)
        .attr("opacity", 1);
    });

    // Soft center ring — shows where low scores live
    grid
      .append("circle")
      .attr("r", innerPad)
      .attr("fill", "none")
      .attr("stroke", gridStroke)
      .attr("stroke-dasharray", "3 4")
      .attr("opacity", playIntro ? 0 : 0.7)
      .transition()
      .duration(playIntro ? 500 : 200)
      .attr("opacity", 0.7);
    } else {
      grid
        .selectAll("polygon, line, circle")
        .transition("theme")
        .duration(themeMs)
        .ease(d3.easeCubicOut)
        .attr("stroke", gridStroke);
    }

    let labels = root.select<SVGGElement>("g.labels");
    if (labels.empty()) labels = root.append("g").attr("class", "labels");

    const labelSel = labels
      .selectAll<SVGTextElement, TeamPoint>("text.axis-label")
      .data(sorted, (d) => d.id);

    labelSel.exit().transition().duration(250).attr("opacity", 0).remove();

    const labelEnter = labelSel
      .enter()
      .append("text")
      .attr("class", "axis-label")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("font-weight", 800)
      .attr("opacity", 0)
      .style("cursor", "pointer");

    const labelsMerged = labelEnter.merge(labelSel);

    labelsMerged
      .text((d) => (d.name.length > 12 ? `${d.name.slice(0, 11)}…` : d.name))
      .transition("theme")
      .duration(themeMs)
      .ease(d3.easeCubicOut)
      .attr("fill", labelFill);
    labelsMerged
      .transition("layout")
      .duration(playIntro ? 600 : 350)
      .delay((_, i) => (playIntro ? 200 + i * 50 : 0))
      .attr("opacity", 1)
      .attr("x", (_, i) => Math.cos(angles[i]) * (radius + 20))
      .attr("y", (_, i) => Math.sin(angles[i]) * (radius + 20));

    let poly = root.select<SVGPolygonElement>("polygon.score-poly");
    if (poly.empty()) {
      poly = root
        .append("polygon")
        .attr("class", "score-poly")
        .attr("fill", fillPoly)
        .attr("stroke", strokePoly)
        .attr("stroke-width", 2.5)
        .attr("stroke-linejoin", "round");
    }
    poly.style("pointer-events", "none");

    const fromPts = sorted.map((team) => {
      const prev = prevPts.current.get(team.id);
      if (playIntro || !prev) return { x: 0, y: 0 };
      return prev;
    });

    poly
      .attr("points", polyString(fromPts))
      .attr("opacity", playIntro ? 0 : 1)
      .transition("theme")
      .duration(themeMs)
      .ease(d3.easeCubicOut)
      .attr("fill", fillPoly)
      .attr("stroke", strokePoly);
    poly
      .transition("layout")
      .duration(playIntro ? 900 : 700)
      .ease(d3.easeCubicOut)
      .attr("opacity", 1)
      .attrTween("points", () => {
        const interp = d3.interpolateString(
          polyString(fromPts),
          polyString(targetPts),
        );
        return (t) => interp(t);
      });

    let dotsG = root.select<SVGGElement>("g.dots");
    if (dotsG.empty()) dotsG = root.append("g").attr("class", "dots");
    // Keep dots above polygon for hit-testing
    dotsG.raise();

    const dots = dotsG
      .selectAll<SVGGElement, TeamPoint>("g.dot")
      .data(sorted, (d) => d.id);

    dots.exit().transition().duration(250).attr("opacity", 0).remove();

    const dotsEnter = dots
      .enter()
      .append("g")
      .attr("class", "dot")
      .attr("opacity", 0)
      .style("cursor", "pointer");

    dotsEnter
      .append("circle")
      .attr("class", "hit")
      .attr("r", 18)
      .attr("fill", "transparent")
      .attr("stroke", "none");
    dotsEnter
      .append("circle")
      .attr("class", "halo")
      .attr("r", 0)
      .attr("fill", "transparent")
      .attr("stroke-width", 2)
      .style("pointer-events", "none");
    dotsEnter
      .append("circle")
      .attr("class", "body")
      .attr("r", 0)
      .attr("stroke-width", 2)
      .style("pointer-events", "none");

    const dotsMerged = dotsEnter.merge(dots);

    function openTipFor(team: TeamPoint, local: Pt, clientX?: number, clientY?: number) {
      keepTip();
      const nearby = sorted
        .map((t, i) => ({ t, i, p: targetPts[i] }))
        .filter(({ p }) => dist(p, local) <= clusterDist)
        .sort((a, b) => b.t.score - a.t.score || a.t.name.localeCompare(b.t.name));

      const items: TipItem[] = (nearby.length > 1 ? nearby : [{ t: team, i: sorted.findIndex((x) => x.id === team.id), p: local }]).map(
        ({ t }) => ({
          team: t,
          rank: t.rank ?? 1,
        }),
      );

      const rect = wrap.getBoundingClientRect();
      const x =
        clientX != null
          ? clientX - rect.left
          : cx + local.x;
      const y =
        clientY != null
          ? clientY - rect.top
          : cy + local.y;

      setTip({
        x,
        y,
        items,
        focusId: team.id,
      });
    }

    function highlightDot(id: number, on: boolean) {
      dotsMerged.each(function (d) {
        if (d.id !== id) return;
        const node = d3.select(this);
        node
          .select("circle.body")
          .transition()
          .duration(160)
          .attr("r", on ? 10 : 7);
        node
          .select("circle.halo")
          .transition()
          .duration(160)
          .attr("r", on ? 18 : 12)
          .attr("opacity", on ? 0.55 : 0.35);
      });
    }

    dotsMerged.each(function (team, i) {
      const node = d3.select(this);
      const target = targetPts[i];
      const prev = prevPts.current.get(team.id);
      const start = playIntro || !prev ? { x: 0, y: 0 } : prev;

      node
        .attr("transform", `translate(${start.x},${start.y})`)
        .transition()
        .duration(playIntro ? 900 : 700)
        .delay(playIntro ? 180 + i * 60 : i * 30)
        .ease(d3.easeCubicOut)
        .attr("opacity", 1)
        .attr("transform", `translate(${target.x},${target.y})`);

      node.select("circle.hit").attr("r", 18);

      node
        .select("circle.halo")
        .attr("stroke", team.color)
        .attr("opacity", 0.35)
        .transition()
        .duration(playIntro ? 900 : 500)
        .attr("r", 12);

      node
        .select("circle.body")
        .attr("fill", team.color)
        .attr("stroke", "#fff8ee")
        .transition()
        .duration(playIntro ? 900 : 500)
        .attr("r", 7);
    });

    dotsMerged
      .on("pointerenter", function (event, team) {
        const i = sorted.findIndex((t) => t.id === team.id);
        const local = targetPts[i] ?? { x: 0, y: 0 };
        highlightDot(team.id, true);
        openTipFor(team, local, event.clientX, event.clientY);
      })
      .on("pointermove", function (event) {
        const rect = wrap.getBoundingClientRect();
        setTip((current) =>
          current
            ? {
                ...current,
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              }
            : current,
        );
      })
      .on("pointerleave", function (_event, team) {
        highlightDot(team.id, false);
        clearTipSoon();
      });

    // Axis labels also open the tip (handy when dots are dense)
    labelsMerged
      .on("pointerenter", function (event, team) {
        const i = sorted.findIndex((t) => t.id === team.id);
        const local = targetPts[i] ?? { x: 0, y: 0 };
        highlightDot(team.id, true);
        openTipFor(team, local, event.clientX, event.clientY);
      })
      .on("pointerleave", function (_event, team) {
        highlightDot(team.id, false);
        clearTipSoon();
      });

    const nextMap = new Map<number, Pt>();
    sorted.forEach((team, i) => nextMap.set(team.id, targetPts[i]));
    prevPts.current = nextMap;

    if (playIntro) {
      root
        .attr("opacity", 0)
        .attr("transform", `translate(${cx},${cy}) scale(0.82)`)
        .transition()
        .duration(700)
        .ease(d3.easeCubicOut)
        .attr("opacity", 1)
        .attr("transform", `translate(${cx},${cy}) scale(1)`);
    }
  }, [dataKey, theme, sorted]);

  const focus =
    tip?.items.find((item) => item.team.id === tip.focusId) ?? tip?.items[0];
  const isCluster = (tip?.items.length ?? 0) > 1;

  return (
    <section className="panel rounded-3xl p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="display-font text-xs font-semibold uppercase tracking-[0.2em] text-muted-soft">
            Live snapshot
          </p>
          <h2 className="display-font text-xl font-bold text-ink">
            Team spider graph
          </h2>
        </div>
        <p className="text-xs font-bold text-muted-soft">
          Hover a dot or name · clustered teams list in the tip
        </p>
      </div>

      <div ref={wrapRef} className="relative w-full">
        <svg ref={svgRef} className="mx-auto block overflow-visible" />

        <AnimatePresence>
          {tip && focus ? (
            <motion.div
              key={isCluster ? `cluster-${tip.items.map((i) => i.team.id).join("-")}` : focus.team.id}
              initial={{ opacity: 0, y: 8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className={`absolute z-20 w-56 overflow-hidden rounded-2xl border border-white/20 shadow-2xl backdrop-blur-xl ${
                isCluster ? "pointer-events-auto" : "pointer-events-none"
              }`}
              style={{
                left: Math.min(
                  Math.max(tip.x + 14, 8),
                  (wrapRef.current?.clientWidth ?? 320) - 232,
                ),
                top: Math.max(tip.y - (isCluster ? 140 : 96), 8),
                background:
                  theme === "dark"
                    ? "linear-gradient(160deg, rgba(30,41,59,0.95), rgba(15,23,42,0.92))"
                    : "linear-gradient(160deg, rgba(255,248,238,0.96), rgba(255,244,214,0.94))",
                boxShadow:
                  theme === "dark"
                    ? "0 18px 40px rgba(0,0,0,0.45)"
                    : "0 18px 40px rgba(42,31,20,0.18)",
              }}
              onPointerEnter={keepTip}
              onPointerLeave={clearTipSoon}
            >
              <div
                className="h-1.5 w-full"
                style={{ backgroundColor: focus.team.color }}
              />
              <div className="px-3.5 py-3">
                {isCluster ? (
                  <div className="mb-2.5">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-soft">
                      {tip.items.length} teams here — pick one
                    </p>
                    <div className="flex max-h-28 flex-col gap-1 overflow-y-auto">
                      {tip.items.map((item) => {
                        const active = item.team.id === tip.focusId;
                        return (
                          <button
                            key={item.team.id}
                            type="button"
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                              active ? "bg-chip" : "hover:bg-chip/60"
                            }`}
                            onPointerEnter={() =>
                              setTip((current) =>
                                current
                                  ? { ...current, focusId: item.team.id }
                                  : current,
                              )
                            }
                          >
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: item.team.color }}
                            />
                            <span className="truncate text-xs font-bold text-card-ink">
                              {item.team.name}
                            </span>
                            <span className="ml-auto shrink-0 text-xs font-extrabold text-muted-soft">
                              {item.team.score}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full ring-2 ring-white/50"
                    style={{ backgroundColor: focus.team.color }}
                  />
                  <p className="display-font truncate text-base font-bold text-card-ink">
                    {focus.team.name}
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-chip/80 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-soft">
                      Score
                    </p>
                    <p className="display-font text-xl font-bold text-card-ink">
                      {focus.team.score}
                    </p>
                  </div>
                  <div className="rounded-xl bg-chip/80 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-soft">
                      Rank
                    </p>
                    <p className="display-font text-xl font-bold text-card-ink">
                      #{focus.rank}
                    </p>
                  </div>
                </div>
                {typeof focus.team.eventCount === "number" ? (
                  <p className="mt-2 text-xs font-semibold text-muted-soft">
                    {focus.team.eventCount} point event
                    {focus.team.eventCount === 1 ? "" : "s"} recorded
                  </p>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
