"use client";

import { AnimatePresence, motion } from "framer-motion";
import { panelIn, springSnappy } from "@/lib/motion";
import type { FieldNote } from "@/lib/field-notes";
import { parsePointNote } from "@/lib/scoring";
import { BusyLabel } from "./Spinner";
import { NeedsWifiNotice } from "./OfflineBanner";

type Props = {
  notes: FieldNote[];
  online: boolean;
  postingId: string | null;
  postingAll: boolean;
  className?: string;
  onPost: (note: FieldNote) => void;
  onDiscard: (id: string) => void;
  onPostAll: () => void;
};

function tiltFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ((hash % 7) - 3) * 0.7;
}

export function FieldNotes({
  notes,
  online,
  postingId,
  postingAll,
  className = "",
  onPost,
  onDiscard,
  onPostAll,
}: Props) {
  return (
    <motion.section
      layout
      variants={panelIn}
      className={`panel relative flex h-full flex-col overflow-hidden rounded-3xl p-4 sm:p-5 ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-3 rounded-b-md bg-star/80 shadow-sm"
      />
      <div className="mt-2 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="display-font text-xs font-semibold uppercase tracking-[0.22em] text-muted-soft">
            Counselor clipboard
          </p>
          <h2 className="display-font text-xl font-bold text-ink sm:text-2xl">
            Field notes
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted-soft">
            Jot awards on this device, then post them when you have WiFi.
          </p>
        </div>
        <AnimatePresence initial={false}>
          {notes.length > 0 && online ? (
            <motion.button
              key="post-all"
              layout
              initial={{ opacity: 0, scale: 0.9, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 6 }}
              transition={springSnappy}
              type="button"
              onClick={onPostAll}
              disabled={postingAll || postingId !== null}
              className="btn-cta rounded-xl bg-star px-4 py-2 text-sm font-extrabold disabled:opacity-50"
            >
              <BusyLabel busy={postingAll} busyLabel="Posting all…">
                {`Post all (${notes.length})`}
              </BusyLabel>
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      {!online ? (
        <div className="mt-3">
          <NeedsWifiNotice>
            Posting is blocked until you reconnect.
          </NeedsWifiNotice>
        </div>
      ) : null}

      {notes.length === 0 ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-saddle/25 bg-chip/50 px-4 py-10 text-center">
          <p className="display-font text-lg font-bold text-card-ink">
            Clipboard is empty
          </p>
          <p className="mt-1 max-w-xs text-sm font-semibold text-muted-soft">
            Use Award points, then Save for later / Save to field notes.
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid flex-1 auto-rows-min content-start gap-3 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {notes.map((note) => {
              const busy = postingAll || postingId === note.id;
              const parsed = parsePointNote(note.note);
              return (
                <motion.li
                  key={note.id}
                  layout
                  initial={{ opacity: 0, y: 16, rotate: tiltFor(note.id) - 4 }}
                  animate={{ opacity: 1, y: 0, rotate: tiltFor(note.id) }}
                  exit={{ opacity: 0, scale: 0.92, y: -8 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="relative rounded-2xl border-2 border-[#e0c9a0] bg-[#fff6e4] p-3.5 shadow-[0_10px_24px_rgba(42,31,20,0.12)] dark:border-white/15 dark:bg-[#243044]"
                >
                  <span
                    aria-hidden
                    className="absolute -top-2 left-5 h-4 w-10 -rotate-6 rounded-sm bg-[#f0a46a]/90 shadow-sm"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-card-ink">
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: note.teamColor }}
                        />
                        {note.teamName}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-muted-soft">
                        {new Date(note.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`display-font shrink-0 text-2xl font-bold tabular-nums ${
                        note.delta > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {note.delta > 0 ? `+${note.delta}` : note.delta}
                    </span>
                  </div>
                  {parsed.title && parsed.title !== "No note" ? (
                    <p className="mt-2 rounded-xl bg-white/70 px-2.5 py-1.5 text-sm font-semibold text-card-ink dark:bg-black/20">
                      <span className="mr-1.5 rounded-full bg-saddle/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-muted dark:bg-white/10">
                        {parsed.kind === "extra"
                          ? "Extra"
                          : parsed.kind === "activity"
                            ? "Event"
                            : "Note"}
                      </span>
                      {parsed.title}
                      {parsed.capLabel ? (
                        <span className="mt-0.5 block text-xs font-bold text-muted-soft">
                          Cap {parsed.capLabel}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-semibold italic text-muted-soft">
                      No activity note
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onPost(note)}
                      disabled={!online || busy}
                      className="btn-cta rounded-xl bg-star px-3 py-2 text-sm font-extrabold disabled:opacity-50"
                    >
                      <BusyLabel
                        busy={postingId === note.id}
                        busyLabel="Posting…"
                      >
                        {online ? "Post now" : "Needs WiFi"}
                      </BusyLabel>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDiscard(note.id)}
                      disabled={busy}
                      className="btn-danger rounded-xl px-3 py-2 text-sm font-extrabold disabled:opacity-50"
                    >
                      Discard
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </motion.section>
  );
}
