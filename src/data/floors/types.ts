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
  /** Overview pin → open this detail floor on tap */
  detailFloorId?: string;
  /** Optional room to highlight when opening the detail floor */
  detailRoomId?: string;
  /**
   * `region` — colored room on SVG floor plans.
   * `pin` — map pin on the camp overview photo (x/y = center, w = tap diameter).
   */
  marker?: "region" | "pin";
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

/**
 * A place along a route where walkers step onto a road. Drawn as a bar lying
 * across the road, because "cross here" is the one instruction on a camp map
 * that has to be impossible to miss.
 */
export type RouteCrossing = {
  x: number;
  y: number;
  /** Bar angle in degrees; 0 lies flat, so match it to the road it crosses. */
  rotate?: number;
  label: string;
};

/** A walking route between two places, drawn over a floor's background. */
export type CampRoute = {
  id: string;
  /** Floor whose viewBox the points are expressed in. */
  floorId: string;
  fromLabel: string;
  toLabel: string;
  /** Polyline through the floor's coordinate space. */
  points: [number, number][];
  crossings?: RouteCrossing[];
  /** Rough walking time, minutes. */
  minutes: number;
  /** Written directions, for anyone who would rather read than squint. */
  steps: string[];
  /** The same walk described the other way round. Landmarks pass in the
   *  opposite order and "left" becomes "right", so this cannot be generated
   *  by reversing the list. */
  stepsBack: string[];
};

export type FloorBackgroundImage = {
  href: string;
  opacity?: number;
};

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
  /** Satellite or photo underlay — rooms draw as tappable overlays */
  backgroundImage?: FloorBackgroundImage;
  /** Return here from a detail map (e.g. camp overview) */
  parentFloorId?: string;
  /** Hide from the floor tab bar — reached via overview pins */
  showInTabs?: boolean;
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
