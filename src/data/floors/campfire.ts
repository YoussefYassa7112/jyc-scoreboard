import type { FloorPlan } from "./types";

/**
 * Detail map — the campfire site.
 *
 * The clearing, its shape, and the access track down the east side are read
 * off the survey photo. The furniture inside it (fire pit, log seating,
 * firewood) is the standard arrangement for a camp campfire circle rather than
 * anything visible at that resolution — worth correcting once someone has
 * stood in it.
 *
 * This is where the schedule's "Gathering | Compline Prayer" happens.
 */
export const campfireFloor: FloorPlan = {
  id: "campfire",
  label: "Camp fire",
  siteTitle: "Le P'tit Bonheur",
  banner: "CAMP FIRE",
  parentFloorId: "outdoor",
  viewBox: { w: 900, h: 640 },
  outline: "M30,30 H870 V610 H30 Z",
  rooms: [
    {
      id: "clearing",
      name: "Campfire clearing",
      labelLines: ["Campfire", "clearing"],
      blurb: "Open clearing cut into the woods, ringed by trees.",
      kind: "outdoor",
      x: 150,
      y: 120,
      w: 540,
      h: 360,
      shape: "ellipse",
      labelAlign: "top",
    },
    {
      id: "campfire",
      name: "Fire pit",
      labelLines: ["Fire pit"],
      blurb: "The fire itself, in the middle of the clearing.",
      kind: "activity",
      x: 360,
      y: 230,
      w: 130,
      h: 110,
      shape: "ellipse",
    },
    {
      id: "benches",
      name: "Log benches",
      labelLines: ["Log benches"],
      blurb: "Seating logs facing the fire.",
      kind: "activity",
      x: 300,
      y: 370,
      w: 260,
      h: 70,
    },
    {
      id: "wood",
      name: "Firewood",
      labelLines: ["Firewood"],
      blurb: "Stacked wood at the edge of the clearing.",
      kind: "storage",
      x: 690,
      y: 140,
      w: 115,
      h: 80,
    },
    {
      id: "trail",
      name: "Trail to camp",
      labelLines: ["Trail to", "camp"],
      blurb: "Track running back up toward the road and the rest of camp.",
      kind: "outdoor",
      x: 730,
      y: 320,
      w: 110,
      h: 240,
    },
  ],
  exits: [],
  decorations: [
    {
      // Dense woods on every side — the clearing is a hole punched in forest.
      type: "trees",
      spots: [
        { x: 70, y: 90 },
        { x: 140, y: 70 },
        { x: 210, y: 95 },
        { x: 280, y: 70 },
        { x: 350, y: 95 },
        { x: 420, y: 70 },
        { x: 490, y: 95 },
        { x: 560, y: 70 },
        { x: 630, y: 95 },
        { x: 700, y: 70 },
        { x: 770, y: 95 },
        { x: 840, y: 70 },
        { x: 60, y: 160 },
        { x: 55, y: 230 },
        { x: 65, y: 300 },
        { x: 58, y: 370 },
        { x: 62, y: 440 },
        { x: 56, y: 510 },
        { x: 110, y: 570 },
        { x: 190, y: 545 },
        { x: 270, y: 580 },
        { x: 350, y: 550 },
        { x: 430, y: 580 },
        { x: 510, y: 550 },
        { x: 590, y: 575 },
        { x: 670, y: 545 },
        { x: 660, y: 125 },
        { x: 840, y: 200 },
        { x: 790, y: 270 },
        { x: 855, y: 300 },
        { x: 855, y: 420 },
        { x: 855, y: 510 },
        { x: 770, y: 590 },
      ],
    },
  ],
};
