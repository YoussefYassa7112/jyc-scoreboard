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
      className="flex items-start gap-3 rounded-2xl border-2 border-star/45 bg-chip/95 px-3.5 py-3 text-left shadow-sm sm:px-4"
    >
      <span className="inline-flex shrink-0 items-center self-center rounded-xl bg-star px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-on-star sm:text-xs">
        Needs WiFi
      </span>
      <p className="min-w-0 text-sm font-semibold leading-snug text-muted">
        {detail ?? "Map and Schedule still work. Live scores need WiFi."}
      </p>
    </div>
  );
}

export function NeedsWifiNotice({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-star/30 bg-chip/80 px-3 py-2 text-xs font-extrabold text-star">
      Needs WiFi · {children}
    </p>
  );
}
