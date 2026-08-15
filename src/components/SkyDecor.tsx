"use client";

import { motion } from "framer-motion";

const floaters = [
  { emoji: "🤠", top: "6%", left: "3%", size: "text-3xl sm:text-5xl", delay: 0, dur: 5.5 },
  { emoji: "🚀", top: "12%", right: "4%", size: "text-3xl sm:text-5xl", delay: 0.4, dur: 4.8 },
  { emoji: "⭐", top: "22%", left: "8%", size: "text-2xl sm:text-4xl", delay: 0.8, dur: 3.6 },
  { emoji: "🐴", top: "18%", right: "12%", size: "text-2xl sm:text-4xl", delay: 1.1, dur: 6.2 },
  { emoji: "✨", top: "4%", left: "42%", size: "text-xl sm:text-3xl", delay: 0.2, dur: 3.2 },
  { emoji: "🛸", top: "32%", left: "2%", size: "text-2xl sm:text-4xl", delay: 1.4, dur: 5.8 },
  { emoji: "🌟", top: "28%", right: "3%", size: "text-xl sm:text-3xl", delay: 0.6, dur: 4.1 },
  { emoji: "🧸", bottom: "18%", left: "5%", size: "text-3xl sm:text-4xl", delay: 0.9, dur: 5.2 },
  { emoji: "🎯", bottom: "22%", right: "6%", size: "text-2xl sm:text-4xl", delay: 1.3, dur: 4.4 },
  { emoji: "💫", top: "40%", right: "8%", size: "text-xl sm:text-3xl", delay: 1.7, dur: 3.8 },
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
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="cloud-shape float-a left-[-4%] top-[8%] h-10 w-28 md:h-14 md:w-40" />
      <div className="cloud-shape float-b right-[8%] top-[14%] h-8 w-24 md:h-12 md:w-36" />
      <div className="cloud-shape float-a left-[35%] top-[5%] h-7 w-20 opacity-70 md:h-10 md:w-28" />
      <div className="cloud-shape float-b left-[60%] top-[20%] h-6 w-16 opacity-50 md:h-9 md:w-24" />

      {/* Soft cardboard toy-box rings */}
      <div className="absolute left-[-80px] top-[30%] h-40 w-40 rounded-full border-[10px] border-[#c4a574]/35" />
      <div className="absolute right-[-60px] top-[42%] h-32 w-32 rounded-full border-[8px] border-[#1e6bb8]/25" />

      {twinkles.map((t, i) => (
        <motion.span
          key={`twinkle-${i}`}
          className="absolute text-horizon drop-shadow-sm"
          style={{ top: t.top, left: t.left }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.15, 0.7] }}
          transition={{
            duration: 2 + (i % 3) * 0.4,
            repeat: Infinity,
            delay: i * 0.35,
          }}
        >
          ✦
        </motion.span>
      ))}

      {floaters.map((item, i) => (
        <motion.span
          key={`${item.emoji}-${i}`}
          className={`absolute select-none drop-shadow-md max-sm:hidden ${item.size}`}
          style={{
            top: "top" in item ? item.top : undefined,
            bottom: "bottom" in item ? item.bottom : undefined,
            left: "left" in item ? item.left : undefined,
            right: "right" in item ? item.right : undefined,
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{
            opacity: [0.75, 1, 0.75],
            y: [0, -14, 0],
            rotate: [-6, 6, -6],
          }}
          transition={{
            duration: item.dur,
            delay: item.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {item.emoji}
        </motion.span>
      ))}

      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[rgba(61,139,90,0.45)] via-[rgba(61,139,90,0.18)] to-transparent" />
    </div>
  );
}
