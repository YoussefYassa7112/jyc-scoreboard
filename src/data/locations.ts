/**
 * Schedule location registry.
 * Rooms with floorId + roomId can be opened on the map.
 */

export type CampLocation = {
  id: string;
  label: string;
  floorId?: string;
  roomId?: string;
  /**
   * Set on places the maps do not cover — either because they are not a place
   * at all ("On the go") or because we have no plan for that building yet (B4).
   * A block whose locations are all like this shows this line instead of a
   * "see it on the map" button that would only lead somewhere wrong.
   */
  offMapNote?: string;
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
    floorId: "north-shore",
    roomId: "outdoor",
  },
  {
    id: "arbre",
    label: "Arbre en Arbre course",
    floorId: "arbre-en-arbre",
    roomId: "arbre-course",
  },
  {
    id: "b4-common",
    label: "B4-B Common Area",
    offMapNote: "B4 building — no map for it yet",
  },
  {
    id: "b4-stgeorge",
    label: "B4 — St-George",
    offMapNote: "B4 building — no map for it yet",
  },
  {
    id: "r1-churches",
    label: "Church meeting spot",
    // Everyone arrives at whichever spot their own church gathers at, so there
    // is no single room to open — a button here would send every camper to the
    // same wrong place.
    offMapNote: "Meet where your own church gathers — B1 All Churches or B4 St-George",
  },
  {
    id: "rooms",
    label: "Rooms",
    offMapNote: "Your own cabin",
  },
  {
    id: "chapel",
    label: "Chapel",
    floorId: "north-shore",
    roomId: "central",
  },
  {
    id: "campsite",
    label: "Camp Site",
    floorId: "campfire",
    roomId: "campfire",
  },
  {
    id: "open",
    label: "Open",
    offMapNote: "Spot announced on the day",
  },
  {
    id: "bus",
    label: "B1-4 (In Bus)",
    offMapNote: "On the buses — no fixed spot on the map",
  },
  {
    id: "on-the-go",
    label: "On the go",
    offMapNote: "Handed out as you move between activities",
  },
  {
    id: "lake",
    label: "Lac Quenouille",
    floorId: "peninsula",
    roomId: "baignade",
  },
  {
    id: "campfire",
    label: "Camp Fire",
    floorId: "campfire",
    roomId: "campfire",
  },
  {
    id: "central",
    label: "Cafeteria (Topics · Baby foot · Vespers)",
    floorId: "north-shore",
    roomId: "central",
  },
  {
    id: "dorm-1",
    label: "Dorm 1",
    floorId: "north-shore",
    roomId: "dorm-1",
  },
  {
    id: "dorm-2",
    label: "Dorm 2",
    floorId: "north-shore",
    roomId: "dorm-2",
  },
  {
    id: "dorm-3",
    label: "Dorm 3 · Le P'tit Bonheur",
    floorId: "peninsula",
    roomId: "dorm-3",
  },
  {
    id: "baignade",
    label: "Baignade (swimming)",
    floorId: "peninsula",
    roomId: "baignade",
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
  return mappedLocations(ids)[0]?.id ?? null;
}

/** Mapped spots for a schedule block, in listed order. */
export function mappedLocations(ids: string[] | undefined): CampLocation[] {
  if (!ids?.length) return [];
  const out: CampLocation[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const loc = byId.get(id);
    if (!loc?.floorId || !loc.roomId) continue;
    const key = `${loc.floorId}:${loc.roomId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(loc);
  }
  return out;
}

/**
 * Note for a block whose locations are all off-map. Returns null as soon as one
 * of them can be opened on a map, since then the button is the better answer.
 */
export function offMapNoteFor(ids: string[] | undefined): string | null {
  if (!ids?.length) return null;
  if (mappedLocations(ids).length > 0) return null;
  const notes: string[] = [];
  for (const id of ids) {
    const loc = byId.get(id);
    if (!loc) continue;
    const note = loc.offMapNote ?? loc.label;
    if (!notes.includes(note)) notes.push(note);
  }
  return notes.length ? notes.join(" · ") : null;
}

export function locationForRoom(
  floorId: string,
  roomId: string,
): CampLocation | undefined {
  return campLocations.find(
    (loc) => loc.floorId === floorId && loc.roomId === roomId,
  );
}
