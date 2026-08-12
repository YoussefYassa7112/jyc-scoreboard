export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent align-[-3px] ${className}`}
    />
  );
}

export function BusyLabel({
  busy,
  busyLabel,
  children,
}: {
  busy: boolean;
  busyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      {busy ? <Spinner /> : null}
      {busy ? busyLabel : children}
    </span>
  );
}
