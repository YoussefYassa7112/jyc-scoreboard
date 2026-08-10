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
  | "lounge";

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
  | { type: "pin"; x: number; y: number; label: string };

export type FloorPlan = {
  id: string;
  /** Tab / heading label shown in the UI */
  label: string;
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
  lounge: "Lounge",
};
