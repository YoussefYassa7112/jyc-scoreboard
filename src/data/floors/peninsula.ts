import type { FloorPlan } from "./types";

/**
 * Detail map — peninsula (placeholder until the real SVG is added).
 *
 * Baignade and Dorm 3 only. The cafeteria/main lodge sits on the north shore
 * per the survey photo and lives on that floor instead.
 */
export const peninsulaFloor: FloorPlan = {
  id: "peninsula",
  label: "Peninsula",
  siteTitle: "Le P'tit Bonheur",
  banner: "PENINSULA",
  parentFloorId: "outdoor",
  showInTabs: false,
  viewBox: { w: 520, h: 320 },
  outline: "M8,8 H512 V312 H8 Z",
  rooms: [
    {
      id: "baignade",
      name: "Baignade",
      labelLines: ["Baignade"],
      blurb: "Swimming area in the bay off the peninsula shore.",
      kind: "water",
      x: 48,
      y: 48,
      w: 200,
      h: 100,
    },
    {
      id: "dorm-3",
      name: "Dorm 3 · Le P'tit Bonheur",
      labelLines: ["Dorm 3"],
      blurb: "Peninsula cabin — Le P'tit Bonheur.",
      kind: "building",
      x: 290,
      y: 170,
      w: 180,
      h: 100,
    },
  ],
  exits: [],
  decorations: [],
};
