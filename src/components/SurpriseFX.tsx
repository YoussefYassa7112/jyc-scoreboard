"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { cn } from "@/lib/utils";

const ISAIAH_43_1 =
  "But now, thus says the Lord, who created you, O Jacob, And He who formed you, O Israel: “Fear not, for I have redeemed you; I have called you by your name; You are Mine.”";

/** Verse first, then reference — repeated so the marquee loops smoothly */
const CAMP_QUOTES = [
  { quote: ISAIAH_43_1, emoji: "✨" },
  { quote: "Isaiah 43:1", emoji: "📖" },
  { quote: ISAIAH_43_1, emoji: "✨" },
  { quote: "Isaiah 43:1", emoji: "📖" },
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
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {lasers.map((laser, i) => (
        <motion.div
          key={i}
          className="absolute h-0.5 w-40 rounded-full bg-gradient-to-r from-transparent via-[#7dd3fc] to-transparent opacity-50 shadow-[0_0_12px_#38bdf8]"
          style={{ top: laser.top }}
          initial={{ left: "-20%", opacity: 0 }}
          animate={{ left: ["-20%", "120%"], opacity: [0, 0.7, 0] }}
          transition={{
            duration: 1.4,
            delay: laser.delay,
            repeat: Infinity,
            repeatDelay: 10,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function ReachForTheSkyMarquee({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const motionMs = reduceMotion ? "duration-0" : "duration-[400ms]";
  const fadeMs = reduceMotion ? "duration-0" : "duration-200";

  return (
    <div
      className={cn(
        "w-full",
        compact ? "mt-2 max-w-3xl" : "mx-auto mt-4 max-w-3xl px-1",
        className,
      )}
    >
      <div
        className={cn(
          "overflow-hidden border border-saddle/25 bg-card shadow-sm",
          "transition-[border-radius,border-color] ease-[cubic-bezier(0.22,1,0.36,1)]",
          motionMs,
          open ? "rounded-[1.75rem] hover:border-saddle/40" : "rounded-full",
        )}
      >
        <div
          className={cn(
            "grid transition-[grid-template-rows] ease-[cubic-bezier(0.22,1,0.36,1)]",
            motionMs,
            open ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
          )}
          inert={open || undefined}
          aria-hidden={open}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="relative">
              <InfiniteMovingCards
                items={CAMP_QUOTES}
                direction="left"
                speed="slow"
                pauseOnHover={false}
                embedded
                className="pointer-events-none"
              />
              <button
                type="button"
                tabIndex={open ? -1 : 0}
                aria-expanded={open}
                aria-label="Show full Isaiah 43:1 verse"
                title="Tap to read the full verse"
                onClick={() => setOpen(true)}
                className="absolute inset-0 z-10 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-star/50"
              />
            </div>
          </div>
        </div>
        <div
          className={cn(
            "grid transition-[grid-template-rows] ease-[cubic-bezier(0.22,1,0.36,1)]",
            motionMs,
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          inert={!open || undefined}
          aria-hidden={!open}
        >
          <div
            className={cn(
              "min-h-0 overflow-hidden transition-opacity ease-[cubic-bezier(0.22,1,0.36,1)]",
              fadeMs,
              open ? "opacity-100" : "opacity-0",
            )}
          >
            <button
              type="button"
              tabIndex={open ? 0 : -1}
              aria-expanded={open}
              aria-label="Hide full verse"
              onClick={() => setOpen(false)}
              className={cn(
                "w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-star/50",
                compact ? "px-3 py-2 sm:px-4 sm:py-3" : "px-5 py-4",
              )}
            >
              <p
                className={cn(
                  "display-font flex items-center justify-between gap-2 font-extrabold tracking-wide text-card-ink",
                  compact ? "text-xs sm:text-[13px]" : "text-[13px] sm:text-sm",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span aria-hidden>📖</span>
                  Isaiah 43:1
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-soft">
                  Fold
                </span>
              </p>
              <p
                className={cn(
                  "mt-1.5 text-pretty font-semibold text-card-ink",
                  compact
                    ? "text-xs leading-snug sm:text-sm"
                    : "text-[15px] leading-relaxed sm:text-base",
                )}
              >
                {ISAIAH_43_1}
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
