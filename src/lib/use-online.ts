"use client";

import { useEffect, useState } from "react";
import { isBrowserOnline } from "@/lib/offline";

/** Tracks browser online/offline; starts optimistic then syncs on mount. */
export function useOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(isBrowserOnline());
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}
