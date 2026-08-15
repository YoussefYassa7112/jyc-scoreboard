"use client";

type Props = {
  online: boolean;
  /** Extra line under the main message */
  detail?: string;
};

export function OfflineBanner({ online, detail }: Props) {
  if (online) return null;

  return (
    <div
      role="status"
      className="rounded-2xl border-2 border-star/40 bg-chip/90 px-4 py-3 text-left shadow-sm"
    >
      <p className="text-sm font-extrabold text-star">You&apos;re offline</p>
      <p className="mt-1 text-sm font-semibold text-muted">
        {detail ??
          "Map and Schedule still work. Live scores need WiFi."}
      </p>
    </div>
  );
}
