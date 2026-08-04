"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";

const CAMP_QUOTES = [
  { quote: "Reach for the sky", emoji: "🤠" },
  { quote: "To infinity and beyond", emoji: "🚀" },
  { quote: "You've got a friend in me", emoji: "⭐" },
  { quote: "The claw chooses", emoji: "👽" },
  { quote: "There's a snake in my boot", emoji: "🐍" },
  { quote: "Space ranger on duty", emoji: "🛸" },
];

export function SurpriseFX() {
  const lasers = useMemo(
    () => [
      { delay: 0, top: "18%" },
      { delay: 7, top: "34%" },
      { delay: 13, top: "12%" },
    ],
    [],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {lasers.map((laser, i) => (
        <motion.div
          key={i}
          className="absolute h-0.5 w-40 rounded-full bg-gradient-to-r from-transparent via-[#7dd3fc] to-transparent opacity-80 shadow-[0_0_12px_#38bdf8]"
          style={{ top: laser.top }}
          initial={{ left: "-20%", opacity: 0 }}
          animate={{ left: ["-20%", "120%"], opacity: [0, 1, 0] }}
          transition={{
            duration: 1.4,
            delay: laser.delay,
            repeat: Infinity,
            repeatDelay: 10,
            ease: "easeInOut",
          }}
        />
      ))}

      <motion.div
        className="absolute text-2xl sm:text-3xl"
        initial={{ top: "8%", left: "-10%", opacity: 0, rotate: -20 }}
        animate={{
          top: ["8%", "38%"],
          left: ["-10%", "110%"],
          opacity: [0, 1, 1, 0],
          rotate: -25,
        }}
        transition={{
          duration: 2.2,
          repeat: Infinity,
          repeatDelay: 8,
          ease: "easeIn",
        }}
      >
        ☄️
      </motion.div>
    </div>
  );
}

export function ReachForTheSkyMarquee() {
  return (
    <div className="mx-auto mt-4 w-full px-1">
      <InfiniteMovingCards
        items={CAMP_QUOTES}
        direction="left"
        speed="normal"
        pauseOnHover
      />
    </div>
  );
}
