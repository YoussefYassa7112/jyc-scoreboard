"use client";

import {
  useEffect,
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
  type FloorDecoration,
  type MapRoom,
  type RoomKind,
} from "@/data/floors";
import { blocksAtRoom } from "@/lib/schedule-time";

type BuildingMapProps = {
  focusFloorId?: string | null;
  focusRoomId?: string | null;
  /** Bumped on every schedule→map jump so the room re-pulses on arrival */
  focusArrivalNonce?: number | null;
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
  lounge: "#ffd6d0",
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
  lounge: "#3a2228",
  outdoor: "#1a3320",
  water: "#163044",
  building: "#3a2e1c",
};

function roomFill(
  kind: RoomKind,
  dark: boolean,
  active: boolean,
  dimmed: boolean,
) {
  const base = dark ? kindFillDark[kind] : kindFillLight[kind];
  if (active) return dark ? "#0ea5e9" : "#f4d35e";
  if (dimmed) return dark ? "#152038" : "#f3efe6";
  return base;
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
  focusFloorId,
  focusRoomId,
  focusArrivalNonce,
  onOpenScheduleEvent,
}: BuildingMapProps) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const wrapRef = useRef<HTMLElement>(null);
  const [floorId, setFloorId] = useState(defaultFloorId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [spotlightKey, setSpotlightKey] = useState<number | null>(null);

  useEffect(() => {
    if (focusFloorId) setFloorId(focusFloorId);
    if (focusRoomId) setSelectedId(focusRoomId);
  }, [focusFloorId, focusRoomId]);

  // Arriving from a schedule card: bring the map into view, then flash the room
  // so it is obvious which building the event points at.
  useEffect(() => {
    if (!focusArrivalNonce || !focusRoomId) return;
    setSpotlightKey(focusArrivalNonce);
    const timer = window.setTimeout(() => {
      wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [focusArrivalNonce, focusRoomId]);

  const floor = useMemo(() => getFloor(floorId), [floorId]);
  const selected = useMemo(
    () => floor.rooms.find((r) => r.id === selectedId) ?? null,
    [floor.rooms, selectedId],
  );
  const roomEvents = useMemo(
    () => (selected ? blocksAtRoom(selected.id, floorId) : []),
    [selected, floorId],
  );

  const wall = dark ? "rgba(226,232,240,0.85)" : "#2a1f14";
  const floorBg = dark ? "#0b1224" : "#faf6ee";
  const ink = dark ? "#e2e8f0" : "#2a1f14";
  const muted = dark ? "#94a3b8" : "#7a5c4a";

  function clearSelection() {
    setSelectedId(null);
  }

  function onRoomActivate(room: MapRoom) {
    setSelectedId((id) => (id === room.id ? null : room.id));
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="display-font text-xs font-semibold uppercase tracking-[0.22em] text-muted-soft">
            Building guide
          </p>
          <h2 className="display-font text-2xl font-bold text-ink sm:text-3xl">
            {floor.siteTitle ?? "CENTRAL"} · {floor.label}
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted">
            Tap a room for details · tap empty space or leave focus to reset
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.85, +(z - 0.15).toFixed(2)))}
            className="btn-soft rounded-xl border px-3 py-2 text-sm font-extrabold"
          >
            −
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}
            className="btn-soft rounded-xl border px-3 py-2 text-sm font-extrabold"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              clearSelection();
            }}
            className="btn-soft rounded-xl border px-3 py-2 text-xs font-extrabold"
          >
            Reset
          </button>
        </div>
      </div>

      {floors.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {floors.map((f) => {
            const active = f.id === floorId;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFloorId(f.id);
                  clearSelection();
                }}
                className={`rounded-xl px-3.5 py-2 text-sm font-extrabold transition ${
                  active
                    ? "bg-woody text-on-strong shadow-sm"
                    : "border border-saddle/20 bg-card text-card-ink"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3">
          <span className="inline-flex rounded-xl bg-woody px-3.5 py-2 text-sm font-extrabold text-on-strong">
            {floor.label}
          </span>
        </div>
      )}

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

      <div className="mt-4 overflow-auto rounded-2xl border-2 border-saddle/15 bg-chip/40 p-2 sm:p-3">
        <motion.svg
          viewBox={`0 0 ${floor.viewBox.w} ${floor.viewBox.h}`}
          className="mx-auto block h-auto w-full max-w-4xl touch-pan-x touch-pan-y"
          style={{ originX: 0.5, originY: 0 }}
          initial={false}
          animate={{
            scale: zoom,
            minWidth: `${Math.round(320 * zoom)}px`,
          }}
          transition={{ duration: 0.38, ease: easeSoft }}
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
            fill={floorBg}
            rx={12}
            onClick={clearSelection}
          />

          <text
            x={floor.viewBox.w / 2}
            y={28}
            textAnchor="middle"
            fill={muted}
            fontSize={13}
            fontWeight={800}
            style={{ letterSpacing: "0.14em" }}
            className="pointer-events-none"
          >
            {floor.banner}
          </text>

          <path
            d={floor.outline}
            fill={dark ? "#152038" : "#fff8ee"}
            onClick={clearSelection}
          />

          {floor.rooms.map((room) => {
            const active = selectedId === room.id;
            const dimmed = Boolean(selectedId && !active);
            const fontSize = labelFontSize(room);
            const blockY = labelBlockY(room, fontSize);
            const lineH = fontSize * 1.2;
            const startY =
              blockY - ((room.labelLines.length - 1) * lineH) / 2;
            const cx = room.x + room.w / 2;
            const cy = room.y + room.h / 2;
            const ellipse = room.shape === "ellipse";
            const fill = roomFill(room.kind, dark, active, dimmed);
            const stroke = active ? (dark ? "#38bdf8" : "#c45c26") : wall;
            const shared = {
              fill,
              stroke,
              strokeWidth: active ? 3 : 1.6,
              className: "cursor-pointer",
              style: { outline: "none" as const },
              initial: false as const,
              animate: {
                filter: active
                  ? dark
                    ? "drop-shadow(0 0 10px rgba(56,189,248,0.45))"
                    : "drop-shadow(0 0 10px rgba(196,92,38,0.35))"
                  : "drop-shadow(0 0 0 rgba(0,0,0,0))",
              },
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
              "aria-label": room.name,
              "aria-pressed": active,
            };

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
                      fill={ink}
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
                      stroke={dark ? "#38bdf8" : "#c45c26"}
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
                      stroke={dark ? "#38bdf8" : "#c45c26"}
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

          <path
            d={floor.outline}
            fill="none"
            stroke={wall}
            strokeWidth={3.5}
            strokeLinejoin="round"
            className="pointer-events-none"
          />
        </motion.svg>
      </div>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="surface-card mt-4 rounded-2xl border-2 p-4"
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
                className="btn-soft rounded-xl border px-3 py-1.5 text-xs font-extrabold"
              >
                Clear
              </button>
            </div>
            {selected.linksTo?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.linksTo.map((link) => (
                  <button
                    key={`${link.floorId}-${link.roomId}`}
                    type="button"
                    onClick={() => {
                      setFloorId(link.floorId);
                      setSelectedId(link.roomId);
                      setSpotlightKey(Date.now());
                    }}
                    className="btn-cta rounded-xl bg-woody px-3 py-1.5 text-xs font-extrabold"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-4 border-t border-saddle/15 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-soft">
                Scheduled here
              </p>
              {roomEvents.length === 0 ? (
                <p className="mt-1 text-sm font-semibold text-muted">
                  No schedule events are tagged to this room yet.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {roomEvents.map(({ day, block }) => (
                    <li key={`${day.id}-${block.id}`}>
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
                        className="w-full rounded-xl bg-chip/80 px-3 py-2 text-left transition hover:bg-chip"
                      >
                        <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-muted-soft">
                          <span>{day.label}</span>
                          {block.time ? <span>· {block.time}</span> : null}
                          {block.group === "red" || block.group === "green" ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white ${
                                block.group === "green"
                                  ? "bg-[#2F8F4E]"
                                  : "bg-[#C45C26]"
                              }`}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-white/90"
                                aria-hidden
                              />
                              {block.group}
                            </span>
                          ) : null}
                        </p>
                        <p className="display-font text-sm font-bold text-card-ink">
                          {block.title}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-center text-sm font-semibold text-muted-soft"
          >
            Select any spot on the map
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

/** @deprecated Prefer BuildingMap — kept so older imports still work */
export const BasementMap = BuildingMap;
