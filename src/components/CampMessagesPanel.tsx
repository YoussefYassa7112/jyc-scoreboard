"use client";

import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { panelIn, springSoft } from "@/lib/motion";
import { MESSAGE_MAX_LENGTH, type CampMessageRow } from "@/lib/messages";
import { NeedsWifiNotice } from "./OfflineBanner";
import { BusyLabel } from "./Spinner";

type Props = {
  messages: CampMessageRow[];
  online: boolean;
  sending: boolean;
  busyId: number | null;
  onSend: (body: string, pinned: boolean) => void;
  onDelete: (message: CampMessageRow) => void;
  onTogglePin: (message: CampMessageRow) => void;
};

function sentAt(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Send a notice to everyone, and see what has already gone out.
 *
 * Sending needs WiFi — it writes to the database that the camper board reads —
 * so the whole form is disabled offline rather than pretending to queue. Field
 * notes are the offline path for points; a camp-wide announcement that silently
 * waited for a connection would be worse than an obvious "not yet".
 */
export function CampMessagesPanel({
  messages,
  online,
  sending,
  busyId,
  onSend,
  onDelete,
  onTogglePin,
}: Props) {
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const left = MESSAGE_MAX_LENGTH - body.length;

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || text.length > MESSAGE_MAX_LENGTH) return;
    onSend(text, pinned);
    setBody("");
    setPinned(false);
  }

  return (
    <motion.section
      variants={panelIn}
      className="panel rounded-3xl p-4 sm:p-5"
    >
      <h2 className="display-font text-xl font-bold">Camp notices</h2>
      <p className="mt-1 text-sm font-semibold text-muted-soft">
        Goes out to every phone on the camp board, on whichever tab they have
        open.
      </p>

      {!online ? (
        <div className="mt-3">
          <NeedsWifiNotice>
            Connect to send a notice — this one cannot be saved for later.
          </NeedsWifiNotice>
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-4">
        <fieldset disabled={!online} className="min-w-0 border-0 p-0 disabled:opacity-55">
          <label className="block text-sm font-bold text-muted">
            Message
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder="e.g. Buses leave at 4:00 — bags at the front door by 3:30"
              className="field mt-1.5 w-full resize-y rounded-xl border-2 px-3 py-3 text-base font-semibold"
            />
          </label>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-muted">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              Pin to the top
            </label>
            <span
              className={`text-xs font-bold ${
                left < 0 ? "text-red-600" : "text-muted-soft"
              }`}
            >
              {left} left
            </span>
          </div>
          <button
            type="submit"
            disabled={!online || sending || !body.trim() || left < 0}
            className="btn-cta mt-3 w-full rounded-xl bg-star px-4 py-3 text-base font-extrabold disabled:opacity-50"
          >
            <BusyLabel busy={sending} busyLabel="Sending…">
              {online ? "Send to everyone" : "Needs WiFi"}
            </BusyLabel>
          </button>
        </fieldset>
      </form>

      <div className="mt-5 border-t border-saddle/15 pt-4">
        <h3 className="display-font text-sm font-extrabold uppercase tracking-[0.16em] text-muted-soft">
          Sent
        </h3>
        {messages.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-muted-soft">
            Nothing sent yet.
          </p>
        ) : (
          <ul className="mt-3 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.li
                  key={message.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={springSoft}
                  className="surface-card rounded-2xl border-2 px-3 py-2.5"
                >
                  <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted-soft">
                    {message.pinned ? (
                      <span className="rounded-full bg-star px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-on-star">
                        Pinned
                      </span>
                    ) : null}
                    {sentAt(message.createdAt)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-card-ink">
                    {message.body}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onTogglePin(message)}
                      disabled={!online || busyId === message.id}
                      className="btn-chip rounded-xl px-3 py-1.5 text-xs font-extrabold disabled:opacity-60"
                    >
                      {message.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(message)}
                      disabled={!online || busyId === message.id}
                      className="btn-danger rounded-xl px-3 py-1.5 text-xs font-extrabold disabled:opacity-60"
                    >
                      <BusyLabel
                        busy={busyId === message.id}
                        busyLabel="Removing…"
                      >
                        Remove
                      </BusyLabel>
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </motion.section>
  );
}
