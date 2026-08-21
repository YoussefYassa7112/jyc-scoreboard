import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-md rounded-3xl p-6 text-center sm:p-8">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-muted-soft">
          Offline
        </p>
        <p className="inline-flex items-center rounded-xl bg-star px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-on-star">
          Needs WiFi
        </p>
        <h1 className="display-font mt-3 text-3xl font-bold text-ink">
          Connect to continue
        </h1>
        <p className="mt-3 text-sm font-semibold text-muted">
          Open Camp Scoreboard once while on WiFi to cache Map and Schedule.
          Then you can use those tabs without a connection. Live scores, photos,
          and admin edits need WiFi.
        </p>
        <Link
          href="/"
          className="btn-cta mt-6 inline-flex rounded-xl bg-star px-4 py-3 text-sm font-extrabold"
        >
          Try home again
        </Link>
      </div>
    </main>
  );
}
