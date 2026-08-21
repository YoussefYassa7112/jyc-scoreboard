"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BusyLabel } from "./Spinner";

type Props = {
  open: boolean;
  title: string;
  detail: string;
  confirmLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  detail,
  confirmLabel = "Delete",
  busyLabel = "Deleting…",
  cancelLabel = "Cancel",
  busy = false,
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            className="absolute inset-0 bg-black/45"
            onClick={onCancel}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="panel relative z-10 w-full max-w-md rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
          >
            <p
              id="confirm-title"
              className="display-font text-2xl font-bold text-ink"
            >
              {title}
            </p>
            <p className="mt-2 text-sm font-semibold text-muted">{detail}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="btn-chip rounded-xl px-4 py-3 text-sm font-extrabold disabled:opacity-60"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className={`${
                  danger ? "btn-danger" : "btn-cta bg-star"
                } rounded-xl px-4 py-3 text-sm font-extrabold disabled:opacity-60`}
              >
                <BusyLabel busy={busy} busyLabel={busyLabel}>
                  {confirmLabel}
                </BusyLabel>
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
