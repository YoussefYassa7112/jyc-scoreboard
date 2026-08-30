"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { easeSoft } from "@/lib/motion";
import { useTheme } from "@/lib/theme";
import {
  defaultFloorId,
  floors,
  getFloor,
  kindLabel,
  tabFloors,
  type FloorDecoration,
  type MapRoom,
  type RoomKind,
} from "@/data/floors";
import { campTransportNotes, routesForFloor } from "@/data/routes";
import { getScheduleDays } from "@/lib/schedule-demo";
import { blocksAtRoom } from "@/lib/schedule-time";
import { scrollToTarget } from "@/lib/scroll";

type BuildingMapProps = {
  /**
   * False while the camper is on another tab. The panel stays mounted so the
   * chosen floor and zoom survive, but the arrival spotlight must not fire at
   * something nobody is looking at.
   */
  active?: boolean;
  focusFloorId?: string | null;
  focusRoomId?: string | null;
  /** Bumped on every schedule→map jump so the room re-pulses on arrival */
  focusArrivalNonce?: number | null;
  /** Schedule block to highlight in the room's event list */
  focusBlockId?: string | null;
  onFocusCleared?: () => void;
  onOpenScheduleEvent?: (
    dayId: string,
    blockId: string,
    group: "all" | "red" | "green",
    from: { floorId: string; roomId: string },
  ) => void;
};

const kindFillLight: Record<RoomKind, string> = {
  activity: "#ffe8c8",
  storage: "#e8e0d4",
  service: "#dce8f5",
  office: "#e5d4f5",
  stairs: "#f0e6c8",
  outdoor: "#d8f0c8",
  water: "#b8dff0",
  building: "#e8d4b8",
};

const kindFillDark: Record<RoomKind, string> = {
  activity: "#3a2a18",
  storage: "#243044",
  service: "#1a3348",
  office: "#2a2240",
  stairs: "#2f2a18",
  outdoor: "#1a3320",
  water: "#163044",
  building: "#3a2e1c",
};

/**
 * useLayoutEffect warns when React renders on the server. This component only
 * mounts behind the Map tab so it never does today, but the guard keeps that
 * from becoming a console warning if the default tab ever changes.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function pinRadius(room: MapRoom) {
  return Math.max(18, room.w / 2);
}

/** Pin height in viewBox units at scale 1 (head radius + shaft). */
/**
 * Rounds a polyline by curving through the midpoint of each pair of segments.
 * The points are traced off an aerial photo by eye, and hard corners make that
 * guesswork look like precision it does not have.
 */
function routeD(points: [number, number][]) {
  if (points.length < 3) {
    return points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  }
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += ` Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const last = points[points.length - 1];
  d += ` L${last[0]} ${last[1]}`;
  return d;
}

const BASE_PIN_UNITS = 80;
/** How tall a pin should look on screen, whatever the map is scaled to. */
const TARGET_PIN_PX = 30;

/**
 * Never above 1: the overview pin positions are spaced for scale 1, and going
 * past it widens the label pills until "Arbre en Arbre" runs into "North
 * shore". A phone therefore keeps the size it already had (~25px) and only
 * wider screens scale down, which is the case that actually looked wrong.
 */
function clampPinScale(scale: number) {
  return Math.min(1, Math.max(0.4, scale));
}

function roomFill(
  kind: RoomKind,
  dark: boolean,
  active: boolean,
  dimmed: boolean,
  aerial = false,
) {
  if (active) return dark ? "rgba(22, 52, 76, 0.92)" : "rgba(255, 228, 234, 0.94)";
  if (dimmed) return dark ? "rgba(21, 32, 56, 0.35)" : "rgba(243, 239, 230, 0.45)";
  if (aerial) {
    return dark ? "rgba(30, 45, 68, 0.58)" : "rgba(255, 248, 238, 0.78)";
  }
  return dark ? kindFillDark[kind] : kindFillLight[kind];
}

/** Pick a font size that keeps every label line inside the room. */
function labelFontSize(room: MapRoom) {
  const longest = Math.max(...room.labelLines.map((l) => l.length), 1);
  const byWidth = (room.w - 16) / (longest * 0.62);
  const byHeight = (room.h - 12) / (room.labelLines.length * 1.35);
  return Math.max(8, Math.min(13, byWidth, byHeight));
}

function labelBlockY(room: MapRoom, fontSize: number) {
  const blockH = room.labelLines.length * fontSize * 1.2;
  const pad = 10;
  if (room.labelAlign === "top") return room.y + pad + blockH / 2;
  if (room.labelAlign === "bottom") return room.y + room.h - pad - blockH / 2;
  return room.y + room.h / 2;
}

function SofaIcon({ x, y, dark }: { x: number; y: number; dark: boolean }) {
  const fill = dark ? "#f87171" : "#e11d48";
  return (
    <g transform={`translate(${x},${y})`} aria-hidden>
      <rect x={-16} y={-7} width={32} height={14} rx={3} fill={fill} opacity={0.9} />
      <rect x={-16} y={-12} width={7} height={7} rx={2} fill={fill} opacity={0.9} />
      <rect x={9} y={-12} width={7} height={7} rx={2} fill={fill} opacity={0.9} />
    </g>
  );
}

function ExitBadge({
  x,
  y,
  rotate = 0,
}: {
  x: number;
  y: number;
  rotate?: number;
}) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotate})`}>
      <rect x={-34} y={-9} width={68} height={16} rx={4} fill="#dc2626" />
      <text
        textAnchor="middle"
        dy="0.35em"
        fill="#fff"
        fontSize={7}
        fontWeight={800}
      >
        EXIT
      </text>
    </g>
  );
}

function Decorations({
  items,
  wall,
  ink,
  dark,
}: {
  items: FloorDecoration[];
  wall: string;
  ink: string;
  dark: boolean;
}) {
  return (
    <>
      {items.map((item, idx) => {
        if (item.type === "ladder") {
          return (
            <g
              key={idx}
              transform={`translate(${item.x},${item.y})`}
              opacity={0.65}
              aria-hidden
            >
              <line x1={0} y1={0} x2={0} y2={40} stroke={wall} strokeWidth={2} />
              <line x1={12} y1={0} x2={12} y2={40} stroke={wall} strokeWidth={2} />
              {[6, 16, 26, 36].map((yy) => (
                <line
                  key={yy}
                  x1={0}
                  y1={yy}
                  x2={12}
                  y2={yy}
                  stroke={wall}
                  strokeWidth={2}
                />
              ))}
            </g>
          );
        }
        if (item.type === "washFixtures") {
          return (
            <g key={idx} opacity={0.5} aria-hidden>
              <circle
                cx={item.x}
                cy={item.y}
                r={6}
                fill="none"
                stroke={wall}
                strokeWidth={1.5}
              />
              <circle
                cx={item.x + 22}
                cy={item.y}
                r={6}
                fill="none"
                stroke={wall}
                strokeWidth={1.5}
              />
              <rect
                x={item.x + 40}
                y={item.y - 10}
                width={12}
                height={18}
                rx={3}
                fill="none"
                stroke={wall}
                strokeWidth={1.5}
              />
              <rect
                x={item.x + 56}
                y={item.y - 10}
                width={12}
                height={18}
                rx={3}
                fill="none"
                stroke={wall}
                strokeWidth={1.5}
              />
            </g>
          );
        }
        if (item.type === "stairs") {
          const steps = 6;
          const gap = item.h / steps;
          return (
            <g key={idx} aria-hidden>
              {Array.from({ length: steps }, (_, i) => (
                <line
                  key={i}
                  x1={item.x}
                  y1={item.y + i * gap}
                  x2={item.x + item.w}
                  y2={item.y + i * gap}
                  stroke={wall}
                  strokeWidth={1.4}
                  opacity={0.5}
                />
              ))}
              <text
                x={item.x + item.w / 2}
                y={item.y + 14}
                textAnchor="middle"
                fill={ink}
                fontSize={10}
                fontWeight={800}
              >
                H.
              </text>
              <text
                x={item.x + item.w / 2}
                y={item.y + item.h - 6}
                textAnchor="middle"
                fill={ink}
                fontSize={10}
                fontWeight={800}
              >
                B.
              </text>
            </g>
          );
        }
        if (item.type === "fireplace") {
          return (
            <g key={idx} transform={`translate(${item.x},${item.y})`} aria-hidden>
              <path
                d="M0,40 L18,0 L18,80 Z"
                fill={dark ? "#78716c" : "#a8a29e"}
                stroke={wall}
                strokeWidth={1}
              />
            </g>
          );
        }
        if (item.type === "sofas") {
          return (
            <g key={idx}>
              {item.spots.map((s, i) => (
                <SofaIcon key={i} x={s.x} y={s.y} dark={dark} />
              ))}
            </g>
          );
        }
        if (item.type === "opening") {
          return (
            <rect
              key={idx}
              x={item.x}
              y={item.y}
              width={item.w}
              height={item.h}
              rx={2}
              fill={dark ? "#38bdf8" : "#1e6bb8"}
              opacity={0.85}
              className="pointer-events-none"
            />
          );
        }
        if (item.type === "trees") {
          return (
            <g key={idx} aria-hidden>
              {item.spots.map((s, i) => (
                <g key={i} transform={`translate(${s.x},${s.y})`}>
                  <polygon
                    points="0,-16 10,6 -10,6"
                    fill={dark ? "#166534" : "#2F8F4E"}
                    opacity={0.7}
                  />
                  <polygon
                    points="0,-24 8,-4 -8,-4"
                    fill={dark ? "#15803d" : "#3d8b5a"}
                    opacity={0.8}
                  />
                  <rect
                    x={-2}
                    y={6}
                    width={4}
                    height={7}
                    fill={dark ? "#3f2a14" : "#5c4033"}
                  />
                </g>
              ))}
            </g>
          );
        }
        if (item.type === "road") {
          return (
            <g key={idx} aria-hidden>
              <rect
                x={item.x}
                y={item.y}
                width={item.w}
                height={item.h}
                rx={6}
                fill={dark ? "#334155" : "#9ca3af"}
              />
              <text
                x={item.x + item.w / 2}
                y={item.y + item.h / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={dark ? "#e2e8f0" : "#1f2937"}
                fontSize={10}
                fontWeight={800}
              >
                {item.label}
              </text>
            </g>
          );
        }
        if (item.type === "dock") {
          return (
            <g key={idx} aria-hidden>
              <rect
                x={item.x}
                y={item.y}
                width={item.w}
                height={10}
                rx={2}
                fill={dark ? "#a8a29e" : "#d6c4a8"}
              />
              <rect
                x={item.x + item.w - 14}
                y={item.y}
                width={14}
                height={item.h}
                rx={2}
                fill={dark ? "#a8a29e" : "#d6c4a8"}
              />
            </g>
          );
        }
        // pin
        return (
          <g key={idx} transform={`translate(${item.x},${item.y})`} aria-hidden>
            <circle cx={0} cy={0} r={9} fill="#ef4444" opacity={0.22} />
            <path
              d="M0,-14 C-8,-14 -12,-8 -12,-2 C-12,7 0,16 0,16 C0,16 12,7 12,-2 C12,-8 8,-14 0,-14 Z"
              fill="#ef4444"
            />
            <circle cx={0} cy={-3} r={3.5} fill="#fff" />
            <text
              y={24}
              textAnchor="middle"
              fill="#ef4444"
              fontSize={8}
              fontWeight={800}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </>
  );
}

export function BuildingMap({
  // Aliased: the room loop below has its own `active` for the selected room.
  active: panelActive = true,
  focusFloorId,
  focusRoomId,
  focusArrivalNonce,
  focusBlockId,
  onFocusCleared,
  onOpenScheduleEvent,
}: BuildingMapProps) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const wrapRef = useRef<HTMLElement>(null);
  const mapScrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const onFocusClearedRef = useRef(onFocusCleared);
  onFocusClearedRef.current = onFocusCleared;
  const mountedRef = useRef(true);
  const [floorId, setFloorId] = useState(defaultFloorId);
  const [floorDir, setFloorDir] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [spotlightKey, setSpotlightKey] = useState<number | null>(null);
  const [highlightBlockId, setHighlightBlockId] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function goToFloor(nextId: string, options?: { keepSelection?: boolean }) {
    if (nextId === floorId) return;
    const from = floors.findIndex((f) => f.id === floorId);
    const to = floors.findIndex((f) => f.id === nextId);
    setFloorDir(to >= from ? 1 : -1);
    setFloorId(nextId);
    if (!options?.keepSelection) {
      setSelectedId(null);
      setHighlightBlockId(null);
      notifyFocusCleared();
    }
  }

  useEffect(() => {
    if (focusFloorId) goToFloor(focusFloorId, { keepSelection: true });
    if (focusRoomId) setSelectedId(focusRoomId);
    if (focusBlockId) setHighlightBlockId(focusBlockId);
    // goToFloor reads floorId; only re-run when the focus target changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusFloorId, focusRoomId, focusBlockId]);

  // Arriving from a schedule card: bring the map into view, then flash the room
  // so it is obvious which building the event points at.
  useEffect(() => {
    if (!panelActive || !focusArrivalNonce || !focusRoomId) return;
    setSpotlightKey(focusArrivalNonce);
    const timer = window.setTimeout(() => {
      // Aim at the top of the map panel, not its centre — the panel is taller
      // than the viewport, so centring it scrolled straight past the top.
      scrollToTarget(wrapRef.current);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [panelActive, focusArrivalNonce, focusRoomId]);

  useEffect(() => {
    if (!highlightBlockId || !selectedId) return;
    document
      .getElementById(`map-event-${highlightBlockId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [highlightBlockId, selectedId]);

  const floor = useMemo(() => getFloor(floorId), [floorId]);

  /**
   * Pins are drawn in viewBox units, but the map is about 320px wide on a
   * phone and around 950px on a desktop — so an unscaled pin renders roughly
   * three times bigger there, which read as far too heavy. Measure what a unit
   * is actually worth and scale the pins to a constant on-screen size instead.
   * Measuring the <svg> rather than its container means the zoom buttons are
   * accounted for too, so pins hold their size as the map zooms, the way map
   * pins normally behave.
   */
  const [pinScale, setPinScale] = useState(1);

  // Layout effect, not a plain effect: pinScale starts at 1, which is the
  // phone value, so on a desktop a plain effect would paint one frame of
  // full-size pins before snapping them down to 0.4 — a visible jolt every
  // time the map opens. useLayoutEffect measures and re-renders before the
  // browser paints, so the first frame is already the right size.
  useIsomorphicLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.getBoundingClientRect().width;
      if (!width) return;
      const pxPerUnit = width / floor.viewBox.w;
      const next = clampPinScale(TARGET_PIN_PX / (BASE_PIN_UNITS * pxPerUnit));
      // Threshold so a few stray sub-pixel resize callbacks during the zoom
      // width animation cannot loop us through renders.
      setPinScale((current) =>
        Math.abs(current - next) > 0.02 ? next : current,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [floor.viewBox.w]);
  const floorRoutes = routesForFloor(floor.id);
  const activeRoute = floorRoutes.find((route) => route.id === routeId) ?? null;

  const aerial = Boolean(floor.backgroundImage);
  const overview = aerial && floor.rooms.every((r) => r.marker === "pin");
  const selected = useMemo(
    () => floor.rooms.find((r) => r.id === selectedId) ?? null,
    [floor.rooms, selectedId],
  );
  const roomEvents = useMemo(
    () => (selected ? blocksAtRoom(selected.id, floorId, getScheduleDays()) : []),
    [selected, floorId],
  );

  const wall = dark ? "rgba(226,232,240,0.85)" : "#2a1f14";
  const floorBg = dark ? "#0b1224" : "#faf6ee";
  const ink = dark ? "#e2e8f0" : "#2a1f14";
  const laser = dark ? "#38bdf8" : "#e11d48";

  function notifyFocusCleared() {
    if (!mountedRef.current) return;
    onFocusClearedRef.current?.();
  }

  function clearSelection() {
    setSelectedId(null);
    setHighlightBlockId(null);
    notifyFocusCleared();
  }

  function onRoomActivate(room: MapRoom) {
    if (room.detailFloorId) {
      goToFloor(room.detailFloorId, {
        keepSelection: Boolean(room.detailRoomId),
      });
      if (room.detailRoomId) setSelectedId(room.detailRoomId);
      else setSelectedId(null);
      setHighlightBlockId(null);
      setSpotlightKey(Date.now());
      return;
    }
    if (selectedId === room.id) {
      setSelectedId(null);
      setHighlightBlockId(null);
      notifyFocusCleared();
      return;
    }
    setSelectedId(room.id);
    setHighlightBlockId(null);
    setSpotlightKey(Date.now());
  }

  function onMapBlur(e: FocusEvent<HTMLElement>) {
    const next = e.relatedTarget as Node | null;
    if (next && wrapRef.current?.contains(next)) return;
    clearSelection();
  }

  return (
    <section
      ref={wrapRef}
      tabIndex={-1}
      onBlur={onMapBlur}
      className="panel toy-box relative overflow-hidden rounded-3xl p-3 outline-none sm:p-5 md:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="display-font text-xs font-semibold uppercase tracking-[0.22em] text-muted-soft">
            Building guide
          </p>
          <h2 className="display-font text-xl font-bold text-ink sm:text-3xl">
            {floor.siteTitle ?? "CENTRAL"} · {floor.label}
          </h2>
          <p className="mt-1 text-sm font-extrabold text-star">
            {overview
              ? "Tap an area pin to open its detailed map"
              : floor.parentFloorId && floor.parentFloorId !== defaultFloorId
                ? // A floor nested inside another area — the indoor plans. Name
                  // that area, since "go back to overview" sent people looking
                  // in the wrong place for the building they were standing in.
                  `Inside ${getFloor(floor.parentFloorId).label} — tap a room to see what happens there`
                : floor.parentFloorId
                  ? "Detailed area map — tap a room, or go back to the overview"
                  : "This map is tappable — tap any room"}
          </p>
        </div>
        {floor.parentFloorId ? (
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => goToFloor(floor.parentFloorId!)}
              className="btn-soft min-h-11 cursor-pointer rounded-xl border px-3 text-xs font-extrabold"
            >
              {/* Was hard-coded "← Overview", which became wrong the moment the
                  indoor plans were parented to Jeune-Air 1 instead. */}
              ← {getFloor(floor.parentFloorId).label}
            </button>
          </div>
        ) : null}
      </div>

      {tabFloors.length > 1 ? (
        // Wrapping flex rather than a fixed grid: the tab count grows as areas
        // get their own maps, and a fixed column count kept stranding the last
        // tab alone on its own row. Two-up on a phone, three from sm, four from
        // lg — `basis-0` in one row stopped working once "Arbre en Arbre" had
        // to share it with six others.
        <div className="mt-3 flex flex-wrap gap-2">
          {tabFloors.map((f) => {
            const active = f.id === floorId;
            // Floors nested inside another area — the indoor plans — say which
            // area that is. Areas parented to the overview say nothing, since
            // "Overview" under every tab would be noise.
            const parent =
              f.parentFloorId && f.parentFloorId !== defaultFloorId
                ? getFloor(f.parentFloorId).label
                : null;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => goToFloor(f.id)}
                className={`min-h-11 grow basis-[calc(50%-0.25rem)] cursor-pointer rounded-xl px-2 py-2 text-sm font-extrabold transition sm:basis-[calc(33.333%-0.334rem)] sm:px-3.5 lg:basis-[calc(25%-0.375rem)] ${
                  active
                    ? "bg-star text-on-star shadow-sm"
                    : "btn-chip"
                }`}
              >
                {f.label}
                {parent ? (
                  <span className="block text-[10px] font-bold leading-tight opacity-75">
                    in {parent}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3">
          <span className="inline-flex rounded-xl bg-star px-3.5 py-2 text-sm font-extrabold text-on-star">
            {floor.label}
          </span>
        </div>
      )}

      {!overview ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [...new Set(floor.rooms.map((r) => r.kind))] as RoomKind[]
          ).map((kind) => (
            <span
              key={kind}
              className="inline-flex items-center gap-1.5 rounded-full border border-saddle/15 px-2.5 py-1 text-[11px] font-bold text-muted"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: dark ? kindFillDark[kind] : kindFillLight[kind],
                  boxShadow: `inset 0 0 0 1px ${wall}`,
                }}
              />
              {kindLabel[kind]}
            </span>
          ))}
        </div>
      ) : null}

      {floorRoutes.length ? (
        <div className="mt-3">
          <p className="display-font text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-soft">
            Walking routes
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {floorRoutes.map((route) => {
              const on = route.id === routeId;
              return (
                <button
                  key={route.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRouteId(on ? null : route.id)}
                  className={`min-h-11 cursor-pointer rounded-xl border-2 px-3 py-2 text-xs font-extrabold ${
                    on ? "border-star bg-star text-on-star" : "btn-chip"
                  }`}
                >
                  {route.fromLabel} → {route.toLabel}
                  <span className="ml-1.5 font-bold opacity-75">
                    {route.minutes} min
                  </span>
                </button>
              );
            })}
          </div>

          {/* What the colours on the line mean. The yellow one is the only
              part of this map with a safety consequence, so it gets said in
              words as well as drawn. */}
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-saddle/15 px-2.5 py-1 text-[11px] font-bold text-muted">
              <span className="h-1.5 w-5 rounded-full bg-[#38bdf8]" />
              Walking route
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-saddle/15 px-2.5 py-1 text-[11px] font-bold text-muted">
              <span className="h-2.5 w-5 rounded-sm bg-[#facc15] ring-1 ring-saddle/60" />
              Yellow bar = cross the street
            </span>
          </div>

          {campTransportNotes.map((note) => (
            <p
              key={note.id}
              className="mt-2 flex items-start gap-2 text-[11px] font-bold text-muted"
            >
              <span aria-hidden>{note.icon}</span>
              <span>{note.text}</span>
            </p>
          ))}
        </div>
      ) : null}

      {/* Zoom sits directly above the map rather than up in the header. On a
          phone the header, the floor tabs and the legend all stack, which left
          these three buttons most of a screen away from the thing they zoom.
          They also split the full width there, rather than huddling in a
          corner as a thumb-sized target on the widest part of the screen. */}
      <div className="mt-3 flex items-stretch gap-2 sm:justify-end">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.9, +(z - 0.25).toFixed(2)))}
          className="btn-soft min-h-11 flex-1 cursor-pointer rounded-xl border px-0 text-lg font-extrabold sm:min-w-11 sm:flex-none"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
          className="btn-soft min-h-11 flex-1 cursor-pointer rounded-xl border px-0 text-lg font-extrabold sm:min-w-11 sm:flex-none"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            clearSelection();
            mapScrollRef.current?.scrollTo({ top: 0, left: 0 });
          }}
          className="btn-soft min-h-11 flex-1 cursor-pointer rounded-xl border px-3 text-xs font-extrabold sm:flex-none"
        >
          Reset
        </button>
      </div>

      <div style={{ perspective: 1100 }}>
      <motion.div
        initial={{ opacity: 0, rotateX: 16, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        style={{ transformOrigin: "50% 0%" }}
        className={`mt-4 overflow-hidden rounded-2xl border-2 bg-chip/40 ${
          selectedId ? "border-laser ring-2 ring-laser/40" : "border-star/70"
        }`}
      >
        {!selectedId ? (
          <div className="flex items-center justify-center gap-2 bg-star px-3 py-2.5">
            <span className="text-lg" aria-hidden>
              👆
            </span>
            <p className="display-font text-sm font-extrabold text-on-star sm:text-base">
              {overview
                ? "Tap an area pin to explore"
                : "Tap a colored room on the map"}
            </p>
          </div>
        ) : null}
        {/* Was an AnimatePresence `mode="wait"` swap. That made every floor
            change wait 340ms for the outgoing floor's exit before the new one
            could mount — and worse, framer drives those animations with
            requestAnimationFrame, so wherever rAF is throttled (a backgrounded
            tab, iOS low-power mode) the exit never finished and the floor
            simply never changed. The slide is a CSS keyframe now, keyed off the
            floor id so it replays on each switch, and the new floor mounts
            immediately. */}
        <div
          key={floor.id}
          data-dir={floorDir >= 0 ? "forward" : "back"}
          className="map-floor max-h-[min(70dvh,36rem)] overflow-auto overscroll-contain p-1.5 sm:p-3 [touch-action:pan-x_pan-y]"
          ref={mapScrollRef}
        >
        {/* Width, not transform: the parent pans by scrolling, so the zoomed map
            has to actually occupy the wider box. Kept short since every frame of
            a width animation relayouts the SVG. */}
        <motion.div
          initial={false}
          animate={{ width: `${zoom * 100}%` }}
          transition={{ duration: 0.22, ease: easeSoft }}
          className="mx-auto origin-top"
        >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${floor.viewBox.w} ${floor.viewBox.h}`}
          className="mx-auto block h-auto w-full"
          role="img"
          aria-label={`${floor.label} map of ${floor.siteTitle ?? "CENTRAL"}`}
          onClick={(e) => {
            // Clicking empty map canvas clears focus
            if (e.target === e.currentTarget) clearSelection();
          }}
        >
          <rect
            width={floor.viewBox.w}
            height={floor.viewBox.h}
            fill={aerial ? "transparent" : floorBg}
            rx={12}
            onClick={clearSelection}
          />

          {floor.backgroundImage ? (
            <image
              href={floor.backgroundImage.href}
              x={0}
              y={0}
              width={floor.viewBox.w}
              height={floor.viewBox.h}
              preserveAspectRatio="xMidYMid slice"
              opacity={floor.backgroundImage.opacity ?? 1}
              className="pointer-events-none"
            />
          ) : null}

          <text
            x={floor.viewBox.w / 2}
            y={aerial ? 22 : 28}
            textAnchor="middle"
            fill={ink}
            stroke={dark ? "#0b1224" : "#fff8ee"}
            strokeWidth={aerial ? 5 : 4}
            paintOrder="stroke"
            fontSize={aerial ? 13 : 16}
            fontWeight={800}
            style={{ letterSpacing: "0.14em" }}
            className="pointer-events-none"
          >
            {floor.banner}
          </text>

          {activeRoute ? (
            <g className="pointer-events-none">
              {/* Three passes: a dark casing so the line survives whatever the
                  photo is doing underneath, the line itself, then marching
                  dashes that show which way round the walk goes. */}
              <path
                d={routeD(activeRoute.points)}
                fill="none"
                stroke={dark ? "#0b1224" : "#1a120c"}
                strokeOpacity={0.55}
                strokeWidth={10}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={routeD(activeRoute.points)}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={routeD(activeRoute.points)}
                className="map-route-dash"
                fill="none"
                stroke="#f0f9ff"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="9 15"
              />

              {activeRoute.crossings?.map((crossing) => (
                <g
                  key={`${crossing.x}-${crossing.y}`}
                  transform={`translate(${crossing.x} ${crossing.y}) rotate(${crossing.rotate ?? 0})`}
                >
                  <rect
                    x={-17}
                    y={-5}
                    width={34}
                    height={10}
                    rx={3}
                    fill="#facc15"
                    stroke="#1a120c"
                    strokeWidth={1.8}
                  />
                </g>
              ))}

              <circle
                cx={activeRoute.points[0][0]}
                cy={activeRoute.points[0][1]}
                r={6.5}
                fill="#38bdf8"
                stroke="#fff8ee"
                strokeWidth={2.5}
              />
              <circle
                cx={activeRoute.points[activeRoute.points.length - 1][0]}
                cy={activeRoute.points[activeRoute.points.length - 1][1]}
                r={6.5}
                fill="#22c55e"
                stroke="#fff8ee"
                strokeWidth={2.5}
              />
            </g>
          ) : null}

          {!aerial ? (
            <path
              d={floor.outline}
              fill={dark ? "#152038" : "#fff8ee"}
              onClick={clearSelection}
            />
          ) : null}

          {floor.rooms.map((room, roomIndex) => {
            const active = selectedId === room.id;
            const dimmed = Boolean(selectedId && !active);
            const isPin = room.marker === "pin";
            const fontSize = isPin ? 10 : labelFontSize(room);
            const blockY = labelBlockY(room, fontSize);
            const lineH = fontSize * 1.2;
            const startY =
              blockY - ((room.labelLines.length - 1) * lineH) / 2;
            const cx = isPin ? room.x : room.x + room.w / 2;
            const cy = isPin ? room.y : room.y + room.h / 2;
            const pinR = isPin ? pinRadius(room) : 0;
            const ellipse = !isPin && room.shape === "ellipse";
            const fill = roomFill(room.kind, dark, active, dimmed, aerial);
            const stroke = active ? laser : wall;
            // The overview photo is dark green and navy in BOTH themes, so pins
            // use a fixed colour rather than the theme accent — `--star` is a
            // dark brown in daylight and disappeared straight into the trees.
            //
            // Classic map-pin red. Measured against the photo it sits on, red
            // alone runs 2.8–4.0:1 — under the 3:1 floor over the brighter
            // ground by North shore — where the amber it replaces ran 6.6–9.6.
            // So the silhouette is carried by a cream outline instead, which
            // measures 9.9–14.4:1 on the same backgrounds; the red is then free
            // to be the colour rather than the thing doing the work. A
            // near-black outline could not do this job: on dark forest it is
            // only 1.2–1.8:1 and simply vanishes.
            const pinColor = active ? laser : "#ef4444";
            const pinOutline = "#fff8ee";
            const pinDot = "#1a120c";
            // The photo is dark in both themes, so the pill stays light in both
            // rather than following the theme — a navy pill on a night-time
            // satellite image is unreadable.
            const pillFill = "#fff8ee";
            const pillInk = "#2a1f14";
            const pillBorder = active ? laser : "#1a120c";
            const haloW = Math.max(
              10,
              Math.min(24, Math.min(room.w, room.h) * 0.22),
            );
            const shared = {
              fill,
              stroke,
              strokeWidth: active ? 3.2 : 1.6,
              className: "map-room cursor-pointer",
              style: { cursor: "pointer" },
              initial: false as const,
              whileHover: {
                strokeWidth: active ? 3.6 : 2.8,
              },
              whileTap: { scale: 0.97 },
              // No `filter` here any more. A filtered SVG element is promoted
              // to its own composited layer, and that layer was still being
              // composited while the tab panel it lives in animated away —
              // which is how a stray glow could survive onto another tab and
              // stay there until something forced a full repaint. That is why
              // only a theme toggle or a reload cleared it. Emphasis is stroke
              // width plus the halo strokes below, neither of which needs one.
              animate: {
                strokeWidth: active ? 3.2 : selectedId ? 1.4 : 2.2,
              },
              transition: { duration: 0.2 },
              onClick: (e: MouseEvent) => {
                e.stopPropagation();
                onRoomActivate(room);
              },
              onKeyDown: (e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRoomActivate(room);
                }
                if (e.key === "Escape") clearSelection();
              },
              tabIndex: 0,
              role: "button" as const,
              // Only pins actually open another map. Saying "explore this area"
              // on every room told a screen-reader user that CENTRAL, the dock
              // and the lake each lead somewhere they do not.
              "aria-label": room.detailFloorId
                ? `${room.name} — explore this area`
                : room.name,
              "aria-pressed": active,
            };

            if (isPin) {
              // Every dimension is multiplied by pinScale, which is measured
              // from the rendered SVG so the pin lands at TARGET_PIN_PX no
              // matter how wide the map is. The base numbers below are the
              // phone case (scale ~1); on a desktop the scale drops to roughly
              // 0.4 and the whole marker shrinks with it.
              const s = pinScale;
              const label = room.labelLines[0] ?? room.name;
              const FONT = 30 * s;
              const pillH = 44 * s;
              const pillW = (label.length * 15.5 + 60) * s;
              const pillY = 10 * s;
              const tipY = 0;
              const headY = -54 * s;
              const headR = 26 * s;

              return (
                <g key={room.id}>
                  {/* One hit area covering pin and label, so the whole marker
                      is tappable rather than just the teardrop. */}
                  <rect
                    x={cx - Math.max(pinR, pillW / 2)}
                    y={cy + headY - headR - 6}
                    width={Math.max(pinR * 2, pillW)}
                    height={-headY + headR + pillY + pillH + 12}
                    rx={16 * s}
                    fill="transparent"
                    className="map-room cursor-pointer"
                    style={{ cursor: "pointer" }}
                    onClick={shared.onClick}
                    onKeyDown={shared.onKeyDown}
                    tabIndex={0}
                    role="button"
                    aria-label={shared["aria-label"]}
                    aria-pressed={active}
                  />

                  <g
                    transform={`translate(${cx},${cy})`}
                    className="pointer-events-none"
                    aria-hidden
                    opacity={dimmed ? 0.45 : 1}
                  >
                    {/* Attention pulse. A scaling/fading <g> rather than an
                        animated filter or radius — this stays on the
                        compositor and never re-rasterises the photo under it.
                        Paused via prefers-reduced-motion in globals.css. */}
                    <g
                      className={`map-pin-pulse map-pin-pulse-${(roomIndex % 4) + 1}`}
                    >
                      <circle
                        cx={0}
                        cy={headY}
                        r={headR + 8 * s}
                        fill="none"
                        stroke={pinColor}
                        strokeWidth={5 * s}
                      />
                    </g>

                    {/* Ground shadow so the pin reads as sitting on the photo */}
                    <ellipse
                      cx={0}
                      cy={tipY + 3 * s}
                      rx={11 * s}
                      ry={4 * s}
                      fill="#000"
                      opacity={0.45}
                    />

                    <g
                      className="map-pin-body"
                      style={{ transform: active ? "scale(1.12)" : "scale(1)" }}
                    >
                      <path
                        d={`M0,${tipY} C${-8 * s},${-16 * s} ${-headR},${-30 * s} ${-headR},${headY} A${headR},${headR} 0 1,1 ${headR},${headY} C${headR},${-30 * s} ${8 * s},${-16 * s} 0,${tipY} Z`}
                        fill={pinColor}
                        stroke={pinOutline}
                        strokeWidth={4 * s}
                        strokeLinejoin="round"
                      />
                      <circle cx={0} cy={headY} r={9 * s} fill={pinDot} />
                    </g>

                    {/* Label pill: solid, not outlined text. The satellite photo
                        is dark and busy, and stroked text disappeared into it. */}
                    <g className="map-pin-label">
                      <rect
                        x={-pillW / 2}
                        y={pillY}
                        width={pillW}
                        height={pillH}
                        rx={pillH / 2}
                        fill={pillFill}
                        stroke={pillBorder}
                        strokeWidth={(active ? 4 : 2.5) * s}
                      />
                      <text
                        x={-9 * s}
                        y={pillY + pillH / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={pillInk}
                        fontSize={FONT}
                        fontWeight={800}
                        className="select-none"
                      >
                        {label}
                      </text>
                      {/* "explore" affordance */}
                      <text
                        x={pillW / 2 - 20 * s}
                        y={pillY + pillH / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={active ? laser : pinColor}
                        fontSize={FONT + 4 * s}
                        fontWeight={800}
                        className="select-none"
                      >
                        ›
                      </text>
                    </g>
                  </g>

                  {active && spotlightKey ? (
                    <motion.circle
                      key={`spotlight-${spotlightKey}`}
                      cx={cx}
                      cy={cy + headY}
                      r={headR + 14 * s}
                      fill="none"
                      stroke={laser}
                      className="pointer-events-none"
                      initial={{ opacity: 0, strokeWidth: 3 * s }}
                      animate={{
                        opacity: [0, 0.95, 0.1, 0.95, 0],
                        strokeWidth: [3 * s, 12 * s, 5 * s, 12 * s, 3 * s],
                      }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                    />
                  ) : null}
                </g>
              );
            }

            return (
              <g key={room.id}>
                {ellipse ? (
                  <motion.ellipse
                    cx={cx}
                    cy={cy}
                    rx={room.w / 2}
                    ry={room.h / 2}
                    {...shared}
                  />
                ) : (
                  <motion.rect
                    x={room.x}
                    y={room.y}
                    width={room.w}
                    height={room.h}
                    rx={6}
                    {...shared}
                  />
                )}
                {active ? (
                  <>
                    <clipPath id={`map-halo-clip-${room.id}`}>
                      {ellipse ? (
                        <ellipse
                          cx={cx}
                          cy={cy}
                          rx={room.w / 2}
                          ry={room.h / 2}
                        />
                      ) : (
                        <rect
                          x={room.x}
                          y={room.y}
                          width={room.w}
                          height={room.h}
                          rx={6}
                        />
                      )}
                    </clipPath>
                    <g
                      clipPath={`url(#map-halo-clip-${room.id})`}
                      className="pointer-events-none"
                    >
                      {/* Was one stroke behind an feGaussianBlur. The blur put
                          this room on its own composited layer, which is the
                          layer that could outlive the panel and strand a glow
                          on another tab. Two plain strokes — a wide faint one
                          under a narrower brighter one — read as the same
                          inner glow with no filter and no extra layer. */}
                      {ellipse ? (
                        <>
                          <ellipse
                            cx={cx}
                            cy={cy}
                            rx={room.w / 2}
                            ry={room.h / 2}
                            fill="none"
                            stroke={laser}
                            strokeWidth={haloW}
                            opacity={dark ? 0.28 : 0.2}
                          />
                          <ellipse
                            cx={cx}
                            cy={cy}
                            rx={room.w / 2}
                            ry={room.h / 2}
                            fill="none"
                            stroke={laser}
                            strokeWidth={haloW * 0.45}
                            opacity={dark ? 0.5 : 0.36}
                          />
                        </>
                      ) : (
                        <>
                          <rect
                            x={room.x}
                            y={room.y}
                            width={room.w}
                            height={room.h}
                            rx={6}
                            fill="none"
                            stroke={laser}
                            strokeWidth={haloW}
                            opacity={dark ? 0.28 : 0.2}
                          />
                          <rect
                            x={room.x}
                            y={room.y}
                            width={room.w}
                            height={room.h}
                            rx={6}
                            fill="none"
                            stroke={laser}
                            strokeWidth={haloW * 0.45}
                            opacity={dark ? 0.5 : 0.36}
                          />
                        </>
                      )}
                    </g>
                  </>
                ) : null}
                <g
                  transform={
                    room.labelRotate
                      ? `rotate(${room.labelRotate} ${cx} ${cy})`
                      : undefined
                  }
                >
                  {room.labelLines.map((line, i) => (
                    <text
                      key={`${room.id}-${i}`}
                      x={cx}
                      y={
                        room.labelRotate
                          ? cy - ((room.labelLines.length - 1) * lineH) / 2 + i * lineH
                          : startY + i * lineH
                      }
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={dark ? "#fff8ee" : "#1a120c"}
                      stroke={dark ? "#0b1224" : "#fff8ee"}
                      strokeWidth={active ? 3.5 : 2.6}
                      paintOrder="stroke"
                      strokeLinejoin="round"
                      fontSize={fontSize}
                      fontWeight={800}
                      className="pointer-events-none select-none"
                      opacity={dimmed ? 0.4 : 1}
                    >
                      {line}
                    </text>
                  ))}
                </g>
                {active && spotlightKey ? (
                  ellipse ? (
                    <motion.ellipse
                      key={`spotlight-${spotlightKey}`}
                      cx={cx}
                      cy={cy}
                      rx={room.w / 2 + 6}
                      ry={room.h / 2 + 6}
                      fill="none"
                      stroke={laser}
                      className="pointer-events-none"
                      initial={{ opacity: 0, strokeWidth: 2 }}
                      animate={{
                        opacity: [0, 0.95, 0.1, 0.95, 0],
                        strokeWidth: [2, 10, 3, 10, 2],
                      }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                    />
                  ) : (
                    <motion.rect
                      key={`spotlight-${spotlightKey}`}
                      x={room.x - 5}
                      y={room.y - 5}
                      width={room.w + 10}
                      height={room.h + 10}
                      rx={9}
                      fill="none"
                      stroke={laser}
                      className="pointer-events-none"
                      initial={{ opacity: 0, strokeWidth: 2 }}
                      animate={{
                        opacity: [0, 0.95, 0.1, 0.95, 0],
                        strokeWidth: [2, 10, 3, 10, 2],
                      }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                    />
                  )
                ) : null}
              </g>
            );
          })}

          <Decorations
            items={floor.decorations}
            wall={wall}
            ink={ink}
            dark={dark}
          />

          {floor.exits.map((ex) => (
            <ExitBadge key={ex.id} x={ex.x} y={ex.y} rotate={ex.rotate} />
          ))}

          {!aerial ? (
            <path
              d={floor.outline}
              fill="none"
              stroke={wall}
              strokeWidth={3.5}
              strokeLinejoin="round"
              className="pointer-events-none"
            />
          ) : null}
        </svg>
        </motion.div>
        </div>
      </motion.div>
      </div>

      {activeRoute ? (
        <div className="surface-card mt-4 rounded-2xl border-2 p-4">
          <p className="display-font text-sm font-extrabold text-card-ink">
            {activeRoute.fromLabel} → {activeRoute.toLabel}
            <span className="ml-2 text-xs font-bold text-muted-soft">
              about {activeRoute.minutes} min on foot
            </span>
          </p>

          {activeRoute.crossings?.length ? (
            <p className="mt-2.5 flex items-start gap-2 rounded-xl border-2 border-amber-400 bg-amber-300/25 px-3 py-2 text-xs font-extrabold text-card-ink">
              <span aria-hidden>⚠️</span>
              <span>
                {activeRoute.crossings.map((c) => c.label).join(" · ")} — the
                yellow bar on the map is where the path meets the road.
              </span>
            </p>
          ) : null}

          <ol className="mt-3 space-y-1.5">
            {activeRoute.steps.map((step, i) => (
              <li
                key={step}
                className="flex gap-2.5 text-sm font-semibold text-card-ink"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-star text-[11px] font-extrabold text-on-star">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <p className="mt-3 text-[11px] font-bold text-muted-soft">
            Traced from the aerial photo — follow the trail you can see, not the
            line to the pixel.
          </p>
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {selected ? (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.42, ease: easeSoft }}
            className="overflow-hidden"
          >
            <motion.div
              initial={{ y: 28, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 16, scale: 0.98, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="surface-card mt-4 rounded-2xl border-2 border-laser/50 p-4"
            >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-soft">
                  {kindLabel[selected.kind]}
                </p>
                <h3 className="display-font text-xl font-bold text-card-ink">
                  {selected.name}
                </h3>
                <p className="mt-1 text-sm font-semibold text-muted">
                  {selected.blurb}
                </p>
              </div>
              <button
                type="button"
                onClick={clearSelection}
                className="btn-soft min-h-11 cursor-pointer rounded-xl border px-3 py-2 text-xs font-extrabold"
              >
                Clear room
              </button>
            </div>
            {selected.linksTo?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.linksTo.map((link) => (
                  <button
                    key={`${link.floorId}-${link.roomId}`}
                    type="button"
                    onClick={() => {
                      goToFloor(link.floorId, { keepSelection: true });
                      setSelectedId(link.roomId);
                      setHighlightBlockId(null);
                      setSpotlightKey(Date.now());
                    }}
                    className="btn-cta min-h-11 cursor-pointer rounded-xl bg-star px-3 py-2 text-xs font-extrabold"
                  >
                    {link.label} →
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-4 border-t border-saddle/15 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-soft">
                Scheduled here · tap an event
              </p>
              {roomEvents.length === 0 ? (
                <p className="mt-1 text-sm font-semibold text-muted">
                  No schedule events are tagged to this room yet.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {roomEvents.map(({ day, block }) => {
                    const highlighted = highlightBlockId === block.id;
                    return (
                    <li key={`${day.id}-${block.id}`} id={`map-event-${block.id}`}>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenScheduleEvent?.(
                            day.id,
                            block.id,
                            block.group,
                            { floorId, roomId: selected.id },
                          )
                        }
                        className={`w-full cursor-pointer rounded-xl border-2 px-3 py-2 text-left transition ${
                          highlighted
                            ? "border-laser bg-laser/15 ring-2 ring-laser/50"
                            : "btn-chip hover:brightness-105"
                        }`}
                      >
                        <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-muted-soft">
                          <span>{day.label}</span>
                          {block.time ? <span>· {block.time}</span> : null}
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white ${
                              block.group === "green"
                                ? "bg-[#2F8F4E]"
                                : block.group === "red"
                                  ? "bg-[#C45C26]"
                                  : "bg-[#1E6BB8]"
                            }`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-white/90"
                              aria-hidden
                            />
                            {block.group === "green"
                              ? "Green"
                              : block.group === "red"
                                ? "Red"
                                : "Everyone"}
                          </span>
                        </p>
                        <p className="display-font text-sm font-bold text-card-ink">
                          {block.title}
                        </p>
                        <p
                          className={`mt-1 text-[11px] font-extrabold ${
                            highlighted ? "text-laser" : "text-star"
                          }`}
                        >
                          Open in schedule →
                        </p>
                      </button>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-center text-sm font-extrabold text-star"
          >
            Tap {overview ? "an area pin" : "a room"} —{" "}
            {overview
              ? "opens the detailed map for that area"
              : "rooms light up and open details"}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

/** @deprecated Prefer BuildingMap — kept so older imports still work */
export const BasementMap = BuildingMap;
