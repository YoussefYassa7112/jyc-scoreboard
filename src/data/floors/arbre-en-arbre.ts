import type { FloorPlan } from "./types";

/**
 * Detail map — Arbre en Arbre, the treetop course.
 *
 * IMPORTANT: this layout is invented, not surveyed. The survey photo of this
 * spot shows nothing but canopy — the course is under the leaves — so there
 * was nothing to trace. What is here is the standard shape of a Quebec
 * hébertisme aérien course, which Le P'tit Bonheur de Sablon lists among its
 * activities: you gear up on the ground, warm up on a low practice run, then
 * work through aerial courses of increasing difficulty and come down a zip
 * line at the end.
 *
 * Treat every room here as a placeholder to be corrected by someone who has
 * actually done the course.
 */
export const arbreEnArbreFloor: FloorPlan = {
  id: "arbre-en-arbre",
  label: "Arbre en Arbre",
  siteTitle: "Le P'tit Bonheur",
  banner: "ARBRE EN ARBRE",
  parentFloorId: "outdoor",
  viewBox: { w: 900, h: 640 },
  outline: "M30,30 H870 V610 H30 Z",
  rooms: [
    {
      id: "easy-course",
      name: "Easy course",
      labelLines: ["Easy", "course"],
      blurb: "First aerial run — low platforms and short crossings.",
      kind: "activity",
      x: 90,
      y: 120,
      w: 230,
      h: 150,
    },
    {
      id: "hard-course",
      name: "Harder course",
      labelLines: ["Harder", "course"],
      blurb: "Higher platforms and longer obstacles between the trees.",
      kind: "activity",
      x: 370,
      y: 110,
      w: 230,
      h: 160,
    },
    {
      id: "landing",
      name: "Landing platform",
      labelLines: ["Landing", "platform"],
      blurb: "Where the zip line finishes and harnesses come off.",
      kind: "building",
      x: 650,
      y: 130,
      w: 180,
      h: 140,
    },
    {
      id: "arbre-course",
      name: "Briefing & harness",
      labelLines: ["Briefing", "& harness"],
      blurb:
        "Ground station — safety briefing, harnesses and helmets before you climb.",
      kind: "service",
      x: 70,
      y: 420,
      w: 220,
      h: 130,
    },
    {
      id: "practice",
      name: "Practice course",
      labelLines: ["Practice", "course"],
      blurb: "Low warm-up run to try the clips before going up.",
      kind: "activity",
      x: 330,
      y: 430,
      w: 200,
      h: 120,
    },
    {
      id: "zipline",
      name: "Zip line",
      labelLines: ["Zip line"],
      blurb: "Long descent back to the ground at the end of the course.",
      kind: "activity",
      x: 570,
      y: 430,
      w: 260,
      h: 90,
    },
  ],
  exits: [],
  decorations: [
    {
      // The course is in standing forest — trees are the whole setting here.
      type: "trees",
      spots: [
        { x: 70, y: 90 },
        { x: 150, y: 70 },
        { x: 230, y: 95 },
        { x: 310, y: 70 },
        { x: 390, y: 95 },
        { x: 470, y: 70 },
        { x: 550, y: 95 },
        { x: 630, y: 70 },
        { x: 710, y: 95 },
        { x: 790, y: 70 },
        { x: 850, y: 95 },
        { x: 70, y: 330 },
        { x: 150, y: 360 },
        { x: 230, y: 320 },
        { x: 310, y: 380 },
        { x: 390, y: 330 },
        { x: 470, y: 370 },
        { x: 550, y: 320 },
        { x: 630, y: 380 },
        { x: 710, y: 330 },
        { x: 790, y: 370 },
        { x: 850, y: 330 },
        { x: 50, y: 160 },
        { x: 45, y: 230 },
        { x: 52, y: 470 },
        { x: 48, y: 540 },
        { x: 850, y: 200 },
        { x: 850, y: 470 },
        { x: 110, y: 595 },
        { x: 220, y: 585 },
        { x: 330, y: 595 },
        { x: 440, y: 585 },
        { x: 550, y: 595 },
        { x: 660, y: 585 },
        { x: 770, y: 595 },
        { x: 850, y: 580 },
      ],
    },
  ],
};
