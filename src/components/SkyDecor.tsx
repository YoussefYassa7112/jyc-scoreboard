"use client";

/**
 * Ambient sky layer. Everything here loops forever, so it runs on CSS keyframes
 * rather than framer-motion: nineteen JS-driven springs on a decorative layer
 * cost real frames on a phone, and none of this needs to react to state.
 *
 * There is deliberately no blur on the wrapper either — a filter over animated
 * children forces the whole layer to re-rasterise every frame.
 *
 * The layer is pinned to the viewport, not the page. Sized to the document it
 * stretched over whatever the current tab happened to be tall — 1127px on Map,
 * 4506px on Schedule — so every percentage-placed cloud slid hundreds of pixels
 * on each tab change, and on a phone, where the page is far taller than the
 * screen, everything below the clouds fell off the bottom of the view. Pinning
 * it makes the sky identical at every page length and screen size.
 */

/**
 * `phone` marks the ones that hug the edges of the screen. Every floater used to
 * be hidden below `sm`, which left phones with nothing but out-of-focus cloud
 * blobs while desktop got a full sky — the edge-hugging ones read the same on
 * both without crowding a narrow screen.
 */
const floaters = [
  { emoji: "🤠", top: "6%", left: "3%", size: "text-3xl sm:text-5xl", delay: 0, dur: 5.5, phone: true },
  { emoji: "🚀", top: "12%", right: "4%", size: "text-3xl sm:text-5xl", delay: 0.4, dur: 4.8, phone: true },
  { emoji: "⭐", top: "22%", left: "8%", size: "text-2xl sm:text-4xl", delay: 0.8, dur: 3.6 },
  { emoji: "🐴", top: "18%", right: "12%", size: "text-2xl sm:text-4xl", delay: 1.1, dur: 6.2 },
  { emoji: "✨", top: "4%", left: "42%", size: "text-xl sm:text-3xl", delay: 0.2, dur: 3.2 },
  { emoji: "🛸", top: "32%", left: "2%", size: "text-2xl sm:text-4xl", delay: 1.4, dur: 5.8, phone: true },
  { emoji: "🌟", top: "28%", right: "3%", size: "text-xl sm:text-3xl", delay: 0.6, dur: 4.1, phone: true },
  { emoji: "🧸", bottom: "18%", left: "5%", size: "text-3xl sm:text-4xl", delay: 0.9, dur: 5.2, phone: true },
  { emoji: "🎯", bottom: "22%", right: "6%", size: "text-2xl sm:text-4xl", delay: 1.3, dur: 4.4, phone: true },
  { emoji: "💫", top: "40%", right: "8%", size: "text-xl sm:text-3xl", delay: 1.7, dur: 3.8, phone: true },
  { emoji: "🐎", bottom: "12%", left: "18%", size: "text-2xl sm:text-3xl", delay: 0.5, dur: 6.5 },
  { emoji: "🪐", top: "8%", right: "28%", size: "text-2xl sm:text-3xl", delay: 1.0, dur: 5.0 },
] as const;

const twinkles = [
  { top: "10%", left: "22%" },
  { top: "16%", left: "68%" },
  { top: "35%", left: "15%" },
  { top: "14%", left: "85%" },
  { top: "45%", left: "92%" },
  { top: "50%", left: "6%" },
];

export function SkyDecor() {
  return (
    <div aria-hidden className="sky-floaters pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 opacity-70">
        {/* Only the clouds get the bleed, so they can drift in from off-screen.
            Applied to the whole layer it pushed every edge-anchored floater past
            the viewport, which clipped most of them away on a phone. */}
        <div className="absolute inset-[-40px] scale-105">
          <div className="cloud-shape float-a left-[-4%] top-[8%] h-10 w-28 md:h-14 md:w-40" />
          <div className="cloud-shape float-b right-[8%] top-[14%] h-8 w-24 md:h-12 md:w-36" />
          <div className="cloud-shape float-a left-[35%] top-[5%] h-7 w-20 opacity-70 md:h-10 md:w-28" />
          <div className="cloud-shape float-b left-[60%] top-[20%] h-6 w-16 opacity-50 md:h-9 md:w-24" />
        </div>

        {/* Soft cardboard toy-box rings */}
        <div className="absolute left-[-80px] top-[30%] h-40 w-40 rounded-full border-[10px] border-[#c4a574]/35" />
        <div className="absolute right-[-60px] top-[42%] h-32 w-32 rounded-full border-[8px] border-[#1e6bb8]/25" />

        {twinkles.map((t, i) => (
          <span
            key={`twinkle-${i}`}
            className="sky-twinkle absolute text-horizon drop-shadow-sm"
            style={{
              top: t.top,
              left: t.left,
              animationDuration: `${2 + (i % 3) * 0.4}s`,
              animationDelay: `${i * 0.35}s`,
            }}
          >
            ✦
          </span>
        ))}

        {floaters.map((item, i) => (
          <span
            key={`${item.emoji}-${i}`}
            className={`sky-bob absolute select-none drop-shadow-md ${item.size} ${
              "phone" in item ? "" : "max-sm:hidden"
            }`}
            style={{
              top: "top" in item ? item.top : undefined,
              bottom: "bottom" in item ? item.bottom : undefined,
              left: "left" in item ? item.left : undefined,
              right: "right" in item ? item.right : undefined,
              animationDuration: `${item.dur}s`,
              animationDelay: `${item.delay}s`,
            }}
          >
            {item.emoji}
          </span>
        ))}

        {/* Tail trails behind so the ball leads to the right. */}
        <span className="sky-comet absolute left-0 top-0 text-2xl sm:text-3xl">
          ☄️
        </span>

        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[rgba(61,139,90,0.45)] via-[rgba(61,139,90,0.18)] to-transparent" />
      </div>
    </div>
  );
}
