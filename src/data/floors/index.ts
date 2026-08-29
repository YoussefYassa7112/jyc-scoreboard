import { arbreEnArbreFloor } from "./arbre-en-arbre";
import { basementFloor } from "./basement";
import { cafeteriaFloor } from "./cafeteria";
import { campfireFloor } from "./campfire";
import { northShoreFloor } from "./north-shore";
import { outdoorFloor } from "./outdoor";
import { peninsulaFloor } from "./peninsula";
import type { FloorPlan } from "./types";

export type {
  FloorBackgroundImage,
  FloorDecoration,
  FloorPlan,
  MapRoom,
  RoomKind,
  RoomLink,
  ExitMarker,
} from "./types";
export { kindLabel } from "./types";

/** All floors — including detail maps hidden from tabs. */
/**
 * Order drives the tab strip: overview first, then the outdoor areas roughly
 * as you meet them walking the site, then the two indoor plans inside CENTRAL.
 */
export const floors: FloorPlan[] = [
  outdoorFloor,
  northShoreFloor,
  peninsulaFloor,
  campfireFloor,
  arbreEnArbreFloor,
  basementFloor,
  cafeteriaFloor,
];

/** Floors shown in the tab bar */
export const tabFloors = floors.filter((f) => f.showInTabs !== false);

export const defaultFloorId = outdoorFloor.id;

export function getFloor(id: string): FloorPlan {
  return floors.find((f) => f.id === id) ?? outdoorFloor;
}
