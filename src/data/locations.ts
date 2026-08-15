/**
 * Schedule location registry.
 * Rooms with floorId + roomId can be opened on the map;
 * others show a “no map yet” notice.
 */

export type CampLocation = {
  id: string;
  label: string;
  floorId?: string;
  roomId?: string;
};

export const campLocations: CampLocation[] = [
  {
    id: "nordet",
    label: "B1-B Salle Le Nordet",
    floorId: "basement",
    roomId: "nordet",
  },
  {
    id: "bivouac",
    label: "B1-B Salle Le Bivouac",
    floorId: "basement",
    roomId: "bivouac",
  },
  {
    id: "dentelle",
    label: "B1-B Salle La Dentelle",
    floorId: "basement",
    roomId: "dentelle",
  },
  {
    id: "eveille",
    label: "B1-B Salle L'Éveillé",
    floorId: "basement",
    roomId: "eveille",
  },
  {
    id: "caf",
    label: "B1 — Caf",
    floorId: "cafeteria",
    roomId: "cafeteria",
  },
  {
    id: "outside",
    label: "Outside",
    floorId: "outdoor",
    roomId: "outdoor",
  },
  {
    id: "arbre",
    label: "Arbre en Arbre course",
    floorId: "outdoor",
    roomId: "forest",
  },
  { id: "b4-common", label: "B4-B Common Area" },
  { id: "b4-stgeorge", label: "B4 — St-George" },
  { id: "r1-churches", label: "R1 — All Churches" },
  { id: "rooms", label: "Rooms" },
  { id: "chapel", label: "Chapel" },
  {
    id: "campsite",
    label: "Camp Site",
    floorId: "outdoor",
    roomId: "outdoor",
  },
  {
    id: "open",
    label: "Open area",
    floorId: "outdoor",
    roomId: "outdoor",
  },
  { id: "bus", label: "In Bus / Loading" },
  {
    id: "lake",
    label: "Lac Quenouille",
    floorId: "outdoor",
    roomId: "lake",
  },
  {
    id: "campfire",
    label: "Camp Fire",
    floorId: "outdoor",
    roomId: "campfire",
  },
  {
    id: "central",
    label: "CENTRAL building",
    floorId: "outdoor",
    roomId: "central",
  },
];

const byId = new Map(campLocations.map((l) => [l.id, l]));

export function getLocation(id: string): CampLocation | undefined {
  return byId.get(id);
}

export function locationHasMap(id: string): boolean {
  const loc = byId.get(id);
  return Boolean(loc?.floorId && loc?.roomId);
}

/** First mapped location id, if any */
export function firstMappedLocationId(
  ids: string[] | undefined,
): string | null {
  if (!ids?.length) return null;
  for (const id of ids) {
    if (locationHasMap(id)) return id;
  }
  return null;
}
