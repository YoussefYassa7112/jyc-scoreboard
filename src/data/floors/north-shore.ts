import type { FloorPlan } from "./types";

const mainLodgeLinks = [
  { floorId: "cafeteria", roomId: "cafeteria", label: "Open Cafeteria plan" },
  { floorId: "basement", roomId: "nordet", label: "Open Basement plan" },
];

/**
 * Detail map — north shore (placeholder until the real SVG is added).
 *
 * The survey photo puts the cafeteria between Dorm 1 and Dorm 2 on this shore,
 * not on the peninsula, so the indoor floor plans hang off this floor.
 */
export const northShoreFloor: FloorPlan = {
  id: "north-shore",
  label: "North shore",
  siteTitle: "Le P'tit Bonheur",
  banner: "NORTH SHORE",
  parentFloorId: "outdoor",
  showInTabs: false,
  viewBox: { w: 480, h: 400 },
  outline: "M8,8 H472 V392 H8 Z",
  rooms: [
    {
      id: "dorm-1",
      name: "Dorm 1",
      labelLines: ["Dorm 1"],
      blurb: "North cabin nearest the bay.",
      kind: "building",
      x: 48,
      y: 40,
      w: 180,
      h: 90,
    },
    {
      id: "central",
      name: "Cafeteria",
      labelLines: ["Cafeteria"],
      blurb:
        "Cafeteria — topics, baby foot, vespers & liturgy. Indoor floor plans available.",
      kind: "building",
      x: 48,
      y: 155,
      w: 260,
      h: 100,
      linksTo: mainLodgeLinks,
    },
    {
      id: "dorm-2",
      name: "Dorm 2",
      labelLines: ["Dorm 2"],
      blurb: "Cabin south of the cafeteria.",
      kind: "building",
      x: 48,
      y: 280,
      w: 180,
      h: 90,
    },
  ],
  exits: [],
  decorations: [],
};
