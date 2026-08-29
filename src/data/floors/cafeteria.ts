import type { FloorPlan } from "./types";

/**
 * CENTRAL cafeteria — same building as the basement, one floor up.
 * Stairs sit in the same east-wing spot so the two plans line up.
 *
 * Parented to Camp site 1 for the same reason as the basement: CENTRAL stands
 * there, and the heading, tab hint and back button all read from that.
 */
export const cafeteriaFloor: FloorPlan = {
  id: "cafeteria",
  label: "Cafeteria",
  siteTitle: "Camp site 1 · CENTRAL",
  banner: "CAMP SITE 1 · CENTRAL — CAFETERIA",
  parentFloorId: "north-shore",
  viewBox: { w: 1060, h: 560 },
  outline: "M40,40 H860 V220 H1040 V420 H860 V500 H40 Z",
  rooms: [
    {
      id: "kitchen",
      name: "Cuisine",
      labelLines: ["Cuisine"],
      blurb: "Kitchen / serving line on the west side.",
      kind: "service",
      x: 50,
      y: 50,
      w: 200,
      h: 110,
    },
    {
      id: "cafeteria",
      name: "Cafeteria",
      labelLines: ["Cafeteria"],
      blurb: "Main dining hall — meals, topics, baby foot, and indoor gatherings.",
      kind: "activity",
      x: 50,
      y: 170,
      w: 800,
      h: 320,
    },
    {
      id: "serving",
      name: "Service",
      labelLines: ["Service"],
      blurb: "Snack and drink counter.",
      kind: "service",
      x: 260,
      y: 50,
      w: 280,
      h: 110,
    },
    {
      id: "stairs",
      name: "Escalier",
      labelLines: ["Stairs"],
      blurb: "Stairs down to the basement.",
      kind: "stairs",
      x: 870,
      y: 230,
      w: 70,
      h: 180,
      labelAlign: "top",
      linksTo: [
        { floorId: "basement", roomId: "stairs", label: "Go down to Basement" },
      ],
    },
    {
      id: "entry",
      name: "Entrance",
      labelLines: ["Entry"],
      blurb: "Doors out to the camp grounds.",
      kind: "building",
      x: 950,
      y: 230,
      w: 80,
      h: 140,
      linksTo: [
        // Was outdoor/central, from when the overview WAS the grounds map. The
        // overview is pins only now and has no `central`, so this link went
        // nowhere. Outside CENTRAL's entrance is Camp site 1.
        { floorId: "north-shore", roomId: "central", label: "Go outside" },
      ],
    },
  ],
  exits: [
    { id: "exit-caf", x: 450, y: 508 },
    { id: "exit-stairs", x: 905, y: 428, rotate: -90 },
  ],
  decorations: [
    { type: "stairs", x: 878, y: 265, w: 54, h: 120 },
    { type: "opening", x: 428, y: 496, w: 44, h: 6 },
    { type: "opening", x: 857, y: 300, w: 6, h: 44 },
  ],
};
