"use client";

import { useCallback, useEffect, useState } from "react";

export const PRESENTATION_KEY = "camp-presentation";
export const PRESENTATION_EVENT = "camp-presentation-changed";

function readPresentation(): boolean {
  try {
    return window.localStorage.getItem(PRESENTATION_KEY) === "1";
  } catch {
    return false;
  }
}

function applyPresentationClass(on: boolean) {
  document.documentElement.classList.toggle("presentation", on);
}

export function setPresentationMode(on: boolean) {
  try {
    if (on) window.localStorage.setItem(PRESENTATION_KEY, "1");
    else window.localStorage.removeItem(PRESENTATION_KEY);
  } catch {
    /* private mode */
  }
  applyPresentationClass(on);
  window.dispatchEvent(new Event(PRESENTATION_EVENT));
}

/**
 * Full-stats projector view for standings.
 * Starts off so SSR and the first client paint match, then reads localStorage.
 */
export function usePresentationMode() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = readPresentation();
      setOn(next);
      applyPresentationClass(next);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(PRESENTATION_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(PRESENTATION_EVENT, sync);
    };
  }, []);

  const toggle = useCallback(() => {
    setPresentationMode(!readPresentation());
  }, []);

  const set = useCallback((next: boolean) => {
    setPresentationMode(next);
  }, []);

  return { on, toggle, set };
}
