"use client";

/**
 * Smooth-scroll so a target sits just below the top of the viewport.
 *
 * Replaces `scrollIntoView({ block: "center" })`, which overshot in two ways.
 * Centring only makes sense for something shorter than the viewport — the map
 * panel is taller, so centring it pushed its top off screen. And the scroll was
 * aimed while the tab panel was still animating in, so the target moved after
 * the browser had already computed where to stop.
 *
 * Aiming at the top with a margin fixes the first, and re-checking once the
 * smooth scroll has had time to land fixes the second. The correction is
 * instant rather than smooth so it reads as settling, not as a second scroll,
 * and it only fires when the target actually drifted out of view.
 */
export function scrollToTarget(el: Element | null | undefined, offset = 16) {
  if (!el || typeof window === "undefined") return;

  const aim = (behavior: ScrollBehavior) => {
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior });
  };

  aim("smooth");

  window.setTimeout(() => {
    const { top } = el.getBoundingClientRect();
    if (top < -8 || top > offset + 96) aim("auto");
  }, 500);
}
