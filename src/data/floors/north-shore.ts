import type { FloorPlan } from "./types";

/**
 * Detail map — Jeune-Air 1, reached from the "Jeune-Air 1" pin on the camp
 * overview and from its own tab.
 *
 * The id stays `north-shore`: it is what locations.ts and the overview pin key
 * off, and the shore is still where this is.
 *
 * This is the original camp-grounds plan. Arbre en Arbre and the camp fire are
 * gone because they are their own areas now, reached from their own pins, and
 * B4 is replaced by the two dorms that actually sit on this shore.
 *
 * Layout: lake north, road south, CENTRAL on the east with the open field
 * beside it, the two dorms across the bottom, and the volleyball court in
 * front of Dorm 1.
 */
export const northShoreFloor: FloorPlan = {
  id: "north-shore",
  label: "Jeune-Air 1",
  siteTitle: "Le P'tit Bonheur",
  banner: "JEUNE-AIR 1",
  parentFloorId: "outdoor",
  viewBox: { w: 1060, h: 720 },
  outline: "M30,30 H1030 V690 H30 Z",
  rooms: [
    {
      id: "lake",
      name: "Lac Quenouille",
      labelLines: ["Lake"],
      blurb: "Lac Quenouille — shoreline along the north side of camp.",
      kind: "water",
      x: 50,
      y: 48,
      w: 960,
      h: 150,
    },
    {
      id: "outdoor",
      name: "Outdoor area",
      labelLines: ["Outdoor", "area"],
      blurb: "Open field in the middle of camp — ice-breakers and big games.",
      kind: "outdoor",
      x: 350,
      y: 225,
      w: 260,
      h: 250,
      shape: "ellipse",
    },
    {
      id: "central",
      name: "CENTRAL",
      labelLines: ["CENTRAL", "Caf + Basement"],
      blurb:
        "Main building — cafeteria upstairs, basement downstairs. Topics, baby foot, vespers & liturgy happen here.",
      kind: "building",
      x: 700,
      y: 230,
      w: 240,
      h: 180,
      linksTo: [
        { floorId: "cafeteria", roomId: "cafeteria", label: "Open Cafeteria" },
        { floorId: "basement", roomId: "nordet", label: "Open Basement" },
      ],
    },
    {
      id: "volleyball",
      name: "Volleyball area",
      labelLines: ["Volleyball"],
      blurb: "Volleyball court in front of Dorm 1.",
      kind: "activity",
      x: 150,
      y: 365,
      w: 190,
      h: 115,
    },
    {
      id: "dorm-1",
      name: "Dorm 1 · Girls",
      labelLines: ["Dorm 1", "Girls"],
      blurb: "Girls sleep here — west end of the shore, behind the volleyball court.",
      kind: "building",
      x: 170,
      y: 505,
      w: 230,
      h: 105,
    },
    {
      id: "dorm-2",
      name: "Dorm 2 · Boys & committee",
      labelLines: ["Dorm 2", "Boys + committee"],
      blurb:
        "Boys and the committee sleep here — east end of the shore, below CENTRAL.",
      kind: "building",
      x: 700,
      y: 505,
      w: 240,
      h: 105,
    },
    {
      id: "dock",
      name: "Dock",
      labelLines: ["Dock"],
      blurb: "L-shaped dock on the lake, north of CENTRAL.",
      kind: "water",
      x: 780,
      y: 168,
      w: 90,
      h: 42,
    },
  ],
  exits: [],
  decorations: [
    { type: "dock", x: 800, y: 155, w: 70, h: 28 },
    {
      type: "road",
      x: 50,
      y: 652,
      w: 960,
      h: 30,
      label: "Chem. du Lac Quenouille",
    },
    {
      // Re-scattered for this layout — every spot sits in a gap between rooms
      // rather than under one. Checked against the room rects.
      type: "trees",
      spots: [
        { x: 55, y: 250 },
        { x: 58, y: 330 },
        { x: 52, y: 430 },
        { x: 62, y: 620 },
        { x: 150, y: 265 },
        { x: 235, y: 300 },
        { x: 320, y: 300 },
        { x: 318, y: 420 },
        { x: 360, y: 560 },
        { x: 430, y: 600 },
        { x: 500, y: 555 },
        { x: 570, y: 600 },
        { x: 640, y: 560 },
        { x: 650, y: 250 },
        { x: 660, y: 430 },
        { x: 975, y: 255 },
        { x: 1000, y: 330 },
        { x: 985, y: 450 },
        { x: 965, y: 600 },
      ],
    },
  ],
};
