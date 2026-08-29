import type { FloorPlan } from "./types";

/**
 * Detail map — the peninsula, reached from the "Peninsula" pin on the camp
 * overview.
 *
 * Laid out from the zoomed survey photo. Water sits west and north, the
 * built-up ground runs east. The two annotated spots are the baignade — the
 * swimming water, labelled Lake here — and Dorm 3 · Le P'tit Bonheur.
 *
 * The rest is read off the aerial rather than annotated: the long pier north
 * of the swimming area, the sandy strip along the shore, the boats pulled up
 * south of it, the open lawn in the middle, and the building cluster on the
 * east side. Names for those buildings are a best guess from the photo.
 */
export const peninsulaFloor: FloorPlan = {
  id: "peninsula",
  label: "Peninsula",
  siteTitle: "Le P'tit Bonheur",
  banner: "PENINSULA",
  parentFloorId: "outdoor",
  showInTabs: false,
  viewBox: { w: 1060, h: 700 },
  outline: "M30,30 H1030 V670 H30 Z",
  rooms: [
    {
      id: "baignade",
      name: "Lake — Baignade",
      labelLines: ["Lake"],
      blurb:
        "The baignade — swimming water off the west shore of the peninsula.",
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
      blurb: "Sandy strip between the water and the lawn.",
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
      id: "field",
      name: "Lawn",
      labelLines: ["Lawn"],
      blurb: "Open grass in the middle of the peninsula.",
      kind: "outdoor",
      x: 470,
      y: 60,
      w: 300,
      h: 175,
      shape: "ellipse",
    },
    {
      id: "lodge",
      name: "Main lodge",
      labelLines: ["Main lodge"],
      blurb: "Largest building on the peninsula, north-east of Dorm 3.",
      kind: "building",
      x: 800,
      y: 60,
      w: 200,
      h: 175,
    },
    {
      id: "dorm-3",
      name: "Dorm 3 · Le P'tit Bonheur",
      labelLines: ["Dorm 3", "Le P'tit Bonheur"],
      blurb: "Peninsula cabin — Le P'tit Bonheur.",
      kind: "building",
      x: 470,
      y: 295,
      w: 265,
      h: 145,
    },
    {
      id: "cabins",
      name: "East cabins",
      labelLines: ["East", "cabins"],
      blurb: "Smaller buildings along the east side of the point.",
      kind: "building",
      x: 795,
      y: 295,
      w: 205,
      h: 145,
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
      // Every spot checked against the room rects — none sit under a building.
      type: "trees",
      spots: [
        { x: 450, y: 300 },
        { x: 450, y: 400 },
        { x: 450, y: 500 },
        { x: 320, y: 500 },
        { x: 380, y: 545 },
        { x: 300, y: 580 },
        { x: 45, y: 595 },
        { x: 500, y: 500 },
        { x: 580, y: 540 },
        { x: 680, y: 500 },
        { x: 770, y: 270 },
        { x: 770, y: 480 },
        { x: 785, y: 150 },
        { x: 860, y: 500 },
        { x: 950, y: 540 },
        { x: 990, y: 580 },
        { x: 1015, y: 520 },
      ],
    },
  ],
};
