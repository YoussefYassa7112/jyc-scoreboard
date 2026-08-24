"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type MarqueeItem = {
  quote: string;
  emoji?: string;
};

/**
 * Adapted from Aceternity UI Infinite Moving Cards
 * https://ui.aceternity.com/components/infinite-moving-cards
 */
export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "normal",
  pauseOnHover = true,
  embedded = false,
  className,
}: {
  items: MarqueeItem[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  pauseOnHover?: boolean;
  /** Drop the pill chrome when a parent already draws the frame. */
  embedded?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [start, setStart] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !scrollerRef.current) return;

    const scrollerContent = Array.from(scrollerRef.current.children);
    // Avoid duplicating twice on React Strict Mode remounts
    if (scrollerContent.length > items.length) {
      setStart(true);
      return;
    }

    scrollerContent.forEach((item) => {
      const duplicated = item.cloneNode(true);
      scrollerRef.current?.appendChild(duplicated);
    });

    containerRef.current.style.setProperty(
      "--animation-direction",
      direction === "left" ? "forwards" : "reverse",
    );

    const duration =
      speed === "fast" ? "22s" : speed === "normal" ? "36s" : "55s";
    containerRef.current.style.setProperty("--animation-duration", duration);

    setStart(true);
  }, [direction, items.length, speed]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-10 overflow-hidden",
        embedded
          ? "max-w-none rounded-none border-0 bg-transparent py-1.5 shadow-none"
          : "mx-auto max-w-3xl rounded-full border border-saddle/25 bg-card py-2 shadow-sm",
        "[mask-image:linear-gradient(to_right,transparent,white_6%,white_94%,transparent)]",
        className,
      )}
    >
      <ul
        ref={scrollerRef}
        className={cn(
          "flex w-max min-w-full shrink-0 flex-nowrap gap-3 py-0.5",
          start && "animate-scroll",
          pauseOnHover && "hover:[animation-play-state:paused]",
        )}
      >
        {items.map((item, idx) => (
          <li
            key={`${item.quote}-${idx}`}
            className="relative w-auto max-w-none shrink-0 rounded-full border border-saddle/20 bg-chip px-3 py-1.5 shadow-sm"
          >
            <span className="display-font flex items-center gap-1.5 whitespace-nowrap text-[13px] font-extrabold tracking-wide text-card-ink sm:text-sm">
              {item.emoji ? <span className="text-sm sm:text-[15px]">{item.emoji}</span> : null}
              {item.quote}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
