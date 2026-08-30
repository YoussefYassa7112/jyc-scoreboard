import type { CampRoute } from "./floors/types";

/**
 * Walking routes drawn on the camp overview.
 *
 * Points are in the overview's viewBox (1024×714, matching
 * public/map/camp-overview.jpg), traced along the road and trail visible in
 * the aerial photo. They are a guide, not a survey: the shape of the walk and
 * the place you step onto the road are what matter here.
 */
export const campRoutes: CampRoute[] = [
  {
    id: "site1-to-campfire",
    floorId: "outdoor",
    fromLabel: "Jeune-Air 1",
    toLabel: "Camp fire",
    minutes: 5,
    points: [
      [492, 149],
      [478, 172],
      [459, 193],
      [441, 212],
      [417, 226],
      [396, 243],
      [381, 264],
      [359, 291],
      [333, 312],
      [304, 325],
      [275, 332],
      [249, 323],
      [231, 309],
      [220, 301],
    ],
    crossings: [
      {
        x: 459,
        y: 193,
        rotate: -8,
        label: "Cross the road",
      },
    ],
    steps: [
      "Leave the cabins and head down towards the main road.",
      "Cross the road — look both ways, cars come round the bend fast.",
      "Follow the trail down past the long building and the canoe racks.",
      "Keep left where the track opens out; the fire pit is in the clearing.",
    ],
  },
];

/**
 * Getting between places the map cannot draw a walking line for. Jeune-Air 1
 * and Jeune-Air 2 are far enough apart that nobody should be setting off on
 * foot, so this says so rather than leaving the gap to guesswork.
 */
export const campTransportNotes = [
  {
    id: "site-shuttle",
    icon: "🚌",
    text: "Jeune-Air 1 → Jeune-Air 2 is by shuttle, provided by the churches — it is not a walk.",
  },
];

export function routesForFloor(floorId: string) {
  return campRoutes.filter((route) => route.floorId === floorId);
}

export function routeById(id: string) {
  return campRoutes.find((route) => route.id === id) ?? null;
}
