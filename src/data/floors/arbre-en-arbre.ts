import type { FloorPlan } from "./types";

/** Detail map — Arbre en Arbre treetop course (placeholder until custom SVG is added). */
export const arbreEnArbreFloor: FloorPlan = {
  id: "arbre-en-arbre",
  label: "Arbre en Arbre",
  siteTitle: "Le P'tit Bonheur",
  banner: "ARBRE EN ARBRE",
  parentFloorId: "outdoor",
  showInTabs: false,
  viewBox: { w: 440, h: 300 },
  outline: "M8,8 H432 V292 H8 Z",
  rooms: [
    {
      id: "arbre-course",
      name: "Arbre en Arbre course",
      labelLines: ["Arbre en", "Arbre"],
      blurb: "Treetop obstacle course in the woods above the road.",
      kind: "activity",
      x: 90,
      y: 80,
      w: 260,
      h: 140,
    },
  ],
  exits: [],
  decorations: [],
};
