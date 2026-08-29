import type { FloorPlan } from "./types";

/** Detail map — campfire clearing (placeholder until custom SVG is added). */
export const campfireFloor: FloorPlan = {
  id: "campfire",
  label: "Camp fire",
  siteTitle: "Le P'tit Bonheur",
  banner: "CAMP FIRE",
  parentFloorId: "outdoor",
  showInTabs: false,
  viewBox: { w: 400, h: 280 },
  outline: "M8,8 H392 V272 H8 Z",
  rooms: [
    {
      id: "campfire",
      name: "Camp Fire",
      labelLines: ["Camp", "fire"],
      blurb: "Campfire clearing in the woods.",
      kind: "activity",
      x: 80,
      y: 80,
      w: 240,
      h: 120,
    },
  ],
  exits: [],
  decorations: [],
};
