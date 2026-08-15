import { basementFloor } from "./basement";
import { cafeteriaFloor } from "./cafeteria";
import { outdoorFloor } from "./outdoor";
import type { FloorPlan } from "./types";

export type {
  FloorDecoration,
  FloorPlan,
  MapRoom,
  RoomKind,
  RoomLink,
  ExitMarker,
} from "./types";
export { kindLabel } from "./types";

/** Registry of available floors — append here when adding levels. */
export const floors: FloorPlan[] = [
  outdoorFloor,
  basementFloor,
  cafeteriaFloor,
];

export const defaultFloorId = outdoorFloor.id;

export function getFloor(id: string): FloorPlan {
  return floors.find((f) => f.id === id) ?? outdoorFloor;
}
