import type { FloorPlan } from "./types";

/**
 * Detail map — Sablon, reached from the "Sablon" pin on the camp
 * overview and from its own tab.
 *
 * The id stays `peninsula`: it is what locations.ts and the overview pin key
 * off, and the point is still where this is.
 *
 * Water sits west, the point runs east. Only the two annotated spots are
 * named buildings: the baignade — the swimming water, labelled Lake here —
 * and the Sablon cabin · Le P'tit Bonheur, which sits out toward the east end. The
 * shoreline details (pier, beach, boats) are read off the survey photo; the
 * rest of the point is woods.
 */
export const peninsulaFloor: FloorPlan = {
  id: "peninsula",
  label: "Sablon",
  siteTitle: "Le P'tit Bonheur",
  banner: "SABLON",
  parentFloorId: "outdoor",
  viewBox: { w: 1060, h: 700 },
  outline: "M30,30 H1030 V670 H30 Z",
  rooms: [
    {
      id: "baignade",
      name: "Lake — Baignade",
      labelLines: ["Lake"],
      blurb:
        "The baignade — swimming water off the west shore of Sablon.",
      kind: "water",
      x: 50,
      y: 50,
      w: 380,
      h: 290,
    },
    {
      id: "dock",
      name: "Dock",
      labelLines: ["Dock"],
      blurb: "Long pier running out past the swimming area.",
      kind: "water",
      x: 350,
      y: 75,
      w: 60,
      h: 105,
    },
    {
      id: "beach",
      name: "Beach",
      labelLines: ["Beach"],
      blurb: "Sandy strip between the water and the treeline.",
      kind: "outdoor",
      x: 60,
      y: 370,
      w: 370,
      h: 80,
    },
    {
      id: "boats",
      name: "Canoes & kayaks",
      labelLines: ["Canoes", "& kayaks"],
      blurb: "Boats pulled up on the shore south of the beach.",
      kind: "activity",
      x: 60,
      y: 480,
      w: 200,
      h: 95,
    },
    {
      id: "dorm-3",
      name: "Sablon",
      labelLines: ["Sablon"],
      blurb: "Sablon cabin — Le P'tit Bonheur, out toward the east end.",
      kind: "building",
      x: 620,
      y: 260,
      w: 340,
      h: 210,
    },
  ],
  exits: [],
  decorations: [
    { type: "dock", x: 358, y: 70, w: 50, h: 100 },
    {
      type: "road",
      x: 60,
      y: 610,
      w: 940,
      h: 28,
      label: "Path along the point",
    },
    {
      // The point is mostly woods now that the buildings are down to the Sablon cabin.
      // Every spot is checked against the room rects so nothing sits on a room.
      type: "trees",
      spots: [
        // north-east, between the water and the top edge
        { x: 470, y: 110 },
        { x: 540, y: 80 },
        { x: 610, y: 130 },
        { x: 690, y: 90 },
        { x: 760, y: 140 },
        { x: 830, y: 95 },
        { x: 900, y: 140 },
        { x: 970, y: 100 },
        { x: 520, y: 190 },
        { x: 640, y: 215 },
        { x: 740, y: 205 },
        { x: 860, y: 200 },
        { x: 960, y: 215 },
        // the belt between the shore and the Sablon cabin
        { x: 455, y: 290 },
        { x: 500, y: 350 },
        { x: 460, y: 420 },
        { x: 520, y: 470 },
        { x: 470, y: 540 },
        { x: 550, y: 560 },
        { x: 590, y: 300 },
        { x: 580, y: 420 },
        // east of the Sablon cabin, toward the tip
        { x: 1000, y: 300 },
        { x: 1005, y: 390 },
        // south side, above the path
        { x: 300, y: 520 },
        { x: 360, y: 570 },
        { x: 420, y: 510 },
        { x: 300, y: 595 },
        { x: 45, y: 595 },
        { x: 650, y: 520 },
        { x: 720, y: 560 },
        { x: 800, y: 510 },
        { x: 880, y: 555 },
        { x: 950, y: 510 },
        { x: 1000, y: 560 },
      ],
    },
  ],
};
