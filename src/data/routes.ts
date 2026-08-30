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
    fromLabel: "Jeune-Air",
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
    stepsBack: [
      "Leave the fire pit and pick up the track heading uphill.",
      "Keep right past the canoe racks and the long building.",
      "Follow the trail up until it meets the main road.",
      "Cross the road — look both ways — and the cabins are just above you.",
    ],
  },
  {
    id: "sablon-to-campfire",
    floorId: "outdoor",
    fromLabel: "Sablon",
    toLabel: "Camp fire",
    minutes: 10,
    // Traced from a line drawn straight onto this map, registered by the two
    // pin tips — no rotation to solve and no landmark matching, so the points
    // are where they were put. An earlier attempt worked from a rotated aerial
    // screenshot and drifted into the bay; this one holds the road.
    points: [
      [690, 485],
      [671, 515],
      [661, 524],
      [653, 535],
      [646, 548],
      [639, 561],
      [630, 572],
      [620, 582],
      [608, 592],
      [595, 601],
      [578, 607],
      [562, 609],
      [545, 612],
      [528, 616],
      [510, 622],
      [493, 626],
      [473, 626],
      [456, 621],
      [439, 613],
      [423, 605],
      [407, 593],
      [393, 582],
      [382, 569],
      [373, 554],
      [364, 540],
      [358, 524],
      [357, 509],
      [360, 496],
      [363, 481],
      [364, 467],
      [362, 452],
      [356, 439],
      [346, 428],
      [334, 422],
      [319, 418],
      [306, 412],
      [296, 402],
      [289, 387],
      [283, 370],
      [275, 353],
      [265, 350],
      [251, 353],
      [236, 345],
      [220, 301],
    ],
    steps: [
      "Head off the point on the road past the cabins.",
      "Follow the road south, away from the water, and keep on it as it swings west.",
      "Stay on the road the whole way round the bottom of the bay.",
      "Where it climbs back north past the parking, the fire pit is up on your right.",
    ],
    stepsBack: [
      "Leave the fire pit and follow the road down past the parking.",
      "Keep on it as it bends east and runs along the bottom of the bay.",
      "Stay on the road as it turns north towards the water again.",
      "It runs out onto the point; the Sablon cabins are at the end.",
    ],
  },
];

/**
 * Getting between places the map cannot draw a walking line for. Jeune-Air
 * and Sablon are far enough apart that nobody should be setting off on
 * foot, so this says so rather than leaving the gap to guesswork.
 */
export const campTransportNotes = [
  {
    id: "site-shuttle",
    icon: "🚌",
    text: "Jeune-Air → Sablon is by shuttle, provided by the churches — it is not a walk, in either direction.",
  },
];

export function routesForFloor(floorId: string) {
  return campRoutes.filter((route) => route.floorId === floorId);
}

export function routeById(id: string) {
  return campRoutes.find((route) => route.id === id) ?? null;
}
