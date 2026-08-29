import type { Transition, Variants } from "framer-motion";

/** Slow-out curve used for fades so nothing snaps into place. */
export const easeSoft = [0.22, 1, 0.36, 1] as const;

export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.9,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.7,
};

export const fadeSoft: Transition = { duration: 0.28, ease: easeSoft };

/** Parent wrapper that reveals its panels one after another on first paint. */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

export const panelIn: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springSoft,
  },
};

/** Wrapper that swaps in once loading finishes, staggering the panels inside. */
export const contentSwap: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
  exit: { opacity: 0, transition: fadeSoft },
};

export const listItemIn: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: -8, transition: fadeSoft },
};

/** Shell resize when Present toggles — layout only, no scale blur. */
export const presentLayoutTransition: Transition = {
  layout: { duration: 0.42, ease: easeSoft },
};

/** Standings swap between toy-box list and projector grid. */
export const presentStandingsVariants: Variants = {
  hidden: (dir: number) => ({
    opacity: 0,
    y: dir > 0 ? 16 : -12,
    scale: dir > 0 ? 0.968 : 0.976,
  }),
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.36, ease: easeSoft },
  },
  exit: (dir: number) => ({
    opacity: 0,
    y: dir > 0 ? -8 : 10,
    scale: dir > 0 ? 0.982 : 0.972,
    transition: { duration: 0.26, ease: easeSoft },
  }),
};

export const presentHeaderVariants: Variants = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easeSoft } },
  exit: { opacity: 0, y: 6, transition: { duration: 0.22, ease: easeSoft } },
};

export const presentChromeVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: easeSoft } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.22, ease: easeSoft } },
};
