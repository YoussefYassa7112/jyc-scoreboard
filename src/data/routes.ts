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
    // Registered from an annotated screenshot by matching its two endpoints to
    // the Sablon and Camp fire pins: the photo turned out to be this same map
    // rotated 90.7 degrees at 0.757 scale, which is exactly the kind of clean
    // result that says the fit is real rather than fitted.
    points: [
      [690, 485],
      [642, 487],
      [628, 509],
      [624, 541],
      [592, 548],
      [547, 555],
      [501, 563],
      [459, 574],
      [425, 585],
      [418, 590],
      [400, 577],
      [378, 555],
      [358, 530],
      [345, 506],
      [341, 479],
      [341, 451],
      [339, 430],
      [322, 411],
      [295, 396],
      [267, 383],
      [243, 372],
      [229, 360],
      [222, 339],
      [219, 319],
      [220, 301],
    ],
    steps: [
      "Head off the point on the road past the cabins.",
      "Follow the road round the bottom of the bay, with the water beside you.",
      "Keep on the road as it bends away from the shore and starts to climb.",
      "Carry on until the track opens out — the fire pit is in the clearing.",
    ],
    stepsBack: [
      "Leave the fire pit and follow the track down to the road.",
      "Stay on the road as it drops towards the water.",
      "Follow it round the bottom of the bay, water beside you the whole way.",
      "The road runs out onto the point; the Sablon cabins are at the end.",
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
