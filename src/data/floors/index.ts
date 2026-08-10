import { basementFloor } from "./basement";
import type { FloorPlan } from "./types";

export type {
  FloorDecoration,
  FloorPlan,
  MapRoom,
  RoomKind,
  ExitMarker,
} from "./types";
export { kindLabel } from "./types";

/** Registry of available floors — append here when adding levels. */
export const floors: FloorPlan[] = [basementFloor];

export const defaultFloorId = basementFloor.id;

export function getFloor(id: string): FloorPlan {
  return floors.find((f) => f.id === id) ?? basementFloor;
}
