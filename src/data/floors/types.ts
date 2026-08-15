/**
 * Shared floor-plan types — add new floors as FloorPlan entries
 * without changing the map renderer.
 */

export type RoomKind =
  | "activity"
  | "storage"
  | "service"
  | "office"
  | "stairs"
  | "outdoor"
  | "water"
  | "building";

export type RoomLink = {
  floorId: string;
  roomId: string;
  label: string;
};

export type MapRoom = {
  id: string;
  name: string;
  /** Lines drawn inside the room (kept short so they fit) */
  labelLines: string[];
  blurb: string;
  kind: RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Vertical bias for the label block inside the room */
  labelAlign?: "top" | "center" | "bottom";
  /** Circle / pill outdoor spots */
  shape?: "rect" | "ellipse";
  /** Degrees — used for the volleyball strip */
  labelRotate?: number;
  /** Jump to another floor (stairs, main building) */
  linksTo?: RoomLink[];
};

export type ExitMarker = {
  id: string;
  x: number;
  y: number;
  rotate?: number;
};

export type SofaSpot = { x: number; y: number };

export type FloorDecoration =
  | { type: "ladder"; x: number; y: number }
  | { type: "washFixtures"; x: number; y: number }
  | { type: "stairs"; x: number; y: number; w: number; h: number }
  | { type: "fireplace"; x: number; y: number }
  | { type: "sofas"; spots: SofaSpot[] }
  | { type: "pin"; x: number; y: number; label: string }
  | { type: "opening"; x: number; y: number; w: number; h: number }
  | { type: "trees"; spots: SofaSpot[] }
  | { type: "road"; x: number; y: number; w: number; h: number; label: string }
  | { type: "dock"; x: number; y: number; w: number; h: number };

export type FloorPlan = {
  id: string;
  /** Tab / heading label shown in the UI */
  label: string;
  /** Prefix before the floor name, e.g. CENTRAL */
  siteTitle?: string;
  /** Drawn in the SVG banner */
  banner: string;
  viewBox: { w: number; h: number };
  outline: string;
  rooms: MapRoom[];
  exits: ExitMarker[];
  decorations: FloorDecoration[];
};

export const kindLabel: Record<RoomKind, string> = {
  activity: "Activity",
  storage: "Storage",
  service: "Service",
  office: "Office",
  stairs: "Stairs",
  outdoor: "Outdoor",
  water: "Water",
  building: "Building",
};
