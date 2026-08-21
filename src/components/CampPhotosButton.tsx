"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CAMP_PHOTOS_URL, isSafeExternalUrl } from "@/lib/camp-links";

type Props = {
  online: boolean;
};

export function CampPhotosButton({ online }: Props) {
  const [hint, setHint] = useState<string | null>(null);
  const ready = CAMP_PHOTOS_URL !== "" && isSafeExternalUrl(CAMP_PHOTOS_URL);

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(null), 4200);
    return () => window.clearTimeout(id);
  }, [hint]);

  const label = (
    <span className="inline-flex flex-wrap items-center justify-center gap-2">
      <span aria-hidden>📸</span>
      Camp photos
      {!online ? (
        <span className="text-xs font-bold opacity-80">· Needs WiFi</span>
      ) : null}
    </span>
  );

  const shell =
    "btn-soft display-font relative inline-flex w-full max-w-xs items-center justify-center rounded-2xl border-2 px-5 py-3 text-base font-extrabold sm:w-auto";

  return (
    <div className="relative flex flex-col items-center">
      {ready && online ? (
        <a
          href={CAMP_PHOTOS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={shell}
        >
          {label}
        </a>
      ) : (
        <button
          type="button"
          onClick={() =>
            setHint(
              !ready
                ? "Add the Google Drive link first."
                : "Needs WiFi — the album lives on Google Drive.",
            )
          }
          className={shell}
        >
          {label}
        </button>
      )}

      <AnimatePresence>
        {hint ? (
          <motion.p
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            className="panel absolute top-full z-20 mt-2 w-max max-w-[16rem] rounded-xl border-2 px-3 py-2 text-center text-sm font-bold text-ink shadow-lg"
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
