import type { FloorPlan } from "./types";

/**
 * Detail map — north shore, opened from the "North shore" pin on the camp
 * overview.
 *
 * This is the original camp-grounds plan, kept as-is apart from the edits the
 * overview made necessary: the Arbre en Arbre forest and the campfire now have
 * their own areas reached from their own pins, and B4 is replaced by the two
 * dorms that actually sit on this shore.
 *
 * Layout follows the survey photo — going down the shoreline it reads
 * Dorm 1 → CENTRAL → Dorm 2, with the lake north and the road south.
 */
export const northShoreFloor: FloorPlan = {
  id: "north-shore",
  label: "North shore",
  siteTitle: "P'tit Bonheur",
  banner: "NORTH SHORE",
  parentFloorId: "outdoor",
  showInTabs: false,
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
      id: "volleyball",
      name: "Volleyball area",
      labelLines: ["Volleyball"],
      blurb: "Volleyball court west of the main field.",
      kind: "activity",
      x: 280,
      y: 230,
      w: 70,
      h: 200,
      labelRotate: -90,
    },
    {
      id: "outdoor",
      name: "Outdoor area",
      labelLines: ["Outdoor", "area"],
      blurb: "Open field in the middle of camp — ice-breakers and big games.",
      kind: "outdoor",
      x: 370,
      y: 220,
      w: 280,
      h: 280,
      shape: "ellipse",
    },
    {
      id: "dorm-1",
      name: "Dorm 1",
      labelLines: ["Dorm 1"],
      blurb: "Cabin at the north end of the shore, nearest the dock.",
      kind: "building",
      x: 720,
      y: 215,
      w: 220,
      h: 105,
    },
    {
      id: "central",
      name: "CENTRAL",
      labelLines: ["CENTRAL", "Caf + Basement"],
      blurb:
        "Main building — cafeteria upstairs, basement downstairs. Topics, baby foot, vespers & liturgy happen here.",
      kind: "building",
      x: 720,
      y: 360,
      w: 220,
      h: 170,
      linksTo: [
        { floorId: "cafeteria", roomId: "cafeteria", label: "Open Cafeteria" },
        { floorId: "basement", roomId: "nordet", label: "Open Basement" },
      ],
    },
    {
      id: "dorm-2",
      name: "Dorm 2",
      labelLines: ["Dorm 2"],
      blurb: "Cabin south of CENTRAL, toward the road.",
      kind: "building",
      x: 720,
      y: 548,
      w: 220,
      h: 90,
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
      // Nudged down from y=640 so it clears Dorm 2, which sits lower than the
      // B4 block it replaced.
      type: "road",
      x: 50,
      y: 652,
      w: 960,
      h: 30,
      label: "Chem. du Lac Quenouille",
    },
    {
      // The west side keeps its trees now that the forest room has moved to
      // its own Arbre en Arbre map — it reads as woods rather than a gap.
      type: "trees",
      spots: [
        { x: 80, y: 400 },
        { x: 130, y: 430 },
        { x: 90, y: 480 },
        { x: 170, y: 500 },
        { x: 220, y: 450 },
        { x: 260, y: 520 },
        { x: 340, y: 540 },
        { x: 400, y: 508 },
        { x: 695, y: 508 },
        { x: 680, y: 560 },
        { x: 980, y: 250 },
        { x: 1000, y: 320 },
        { x: 990, y: 480 },
        { x: 960, y: 560 },
        { x: 70, y: 600 },
        { x: 1000, y: 600 },
      ],
    },
  ],
};
