import type { FloorPlan } from "./types";

/**
 * Pin tap-target diameter in SVG units. The overview viewBox is 1024 wide but
 * renders around 360px on a phone, so one SVG unit is roughly a third of a CSS
 * pixel — a target has to be generous here to be comfortably tappable.
 */
const PIN = 96;

/**
 * Camp overview — one pin per general area. Tapping a pin opens that area's
 * detailed map. Individual buildings live on those detail floors, not here.
 *
 * viewBox matches public/map/camp-overview.jpg (1024×714).
 *
 * Pin coordinates come from the annotated survey photo
 * (public/map/grounds-aerial.jpg). Both images are the same satellite frame —
 * verified by landmark alignment to within a pixel — so the hand-drawn boxes
 * on the annotated copy transfer here 1:1. Area pins sit at the centroid of
 * the spots they cover:
 *
 *   Arbre en Arbre (219,116)
 *   Jeune-Air      cabin 1 (478,105) · cafeteria (508,149) · dorm 2 (485,193)
 *   Camp fire      (220,301)
 *   Sablon         baignade (645,449) · dorm 3 (716,509)
 */
export const outdoorFloor: FloorPlan = {
  id: "outdoor",
  label: "Overview",
  siteTitle: "Le P'tit Bonheur",
  banner: "CAMP OVERVIEW",
  viewBox: { w: 1024, h: 714 },
  outline: "M0,0 H1024 V714 H0 Z",
  backgroundImage: { href: "/map/camp-overview.jpg" },
  rooms: [
    {
      id: "arbre-area",
      name: "Arbre en Arbre",
      labelLines: ["Arbre en Arbre"],
      blurb: "Treetop obstacle course in the woods above the road.",
      kind: "activity",
      marker: "pin",
      x: 219,
      y: 116,
      w: PIN,
      h: PIN,
      detailFloorId: "arbre-en-arbre",
    },
    {
      id: "north-shore-area",
      name: "Jeune-Air",
      labelLines: ["Jeune-Air"],
      blurb:
        "Jeune-Air 1, Jeune-Air 2, and the cafeteria — topics, baby foot, vespers & liturgy.",
      kind: "building",
      marker: "pin",
      x: 492,
      y: 149,
      w: PIN,
      h: PIN,
      detailFloorId: "north-shore",
    },
    {
      id: "campfire-area",
      name: "Camp fire",
      labelLines: ["Camp fire"],
      blurb: "Campfire clearing in the woods.",
      kind: "activity",
      marker: "pin",
      x: 220,
      y: 301,
      w: PIN,
      h: PIN,
      detailFloorId: "campfire",
    },
    {
      id: "peninsula-area",
      name: "Sablon",
      labelLines: ["Sablon"],
      blurb: "Baignade (swimming) and the Sablon cabin.",
      kind: "building",
      marker: "pin",
      x: 690,
      y: 485,
      w: PIN,
      h: PIN,
      detailFloorId: "peninsula",
    },
  ],
  exits: [],
  decorations: [],
};
