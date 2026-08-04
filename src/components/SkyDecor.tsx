export function SkyDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="cloud-shape float-a left-[-4%] top-[8%] h-10 w-28 md:h-14 md:w-40" />
      <div className="cloud-shape float-b right-[8%] top-[14%] h-8 w-24 md:h-12 md:w-36" />
      <div className="cloud-shape float-a left-[35%] top-[5%] h-7 w-20 opacity-70 md:h-10 md:w-28" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgba(61,139,90,0.35)] to-transparent" />
    </div>
  );
}
