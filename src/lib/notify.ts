"use client";

/**
 * Local (device-scheduled) notifications only — no push server, no VAPID keys.
 *
 * iPhones expose the Notification API only inside a Home Screen web app, so a
 * plain Safari tab reports "needs-install" and the UI explains the extra step
 * instead of showing a button that silently does nothing.
 */

export type NotifySupport = "supported" | "needs-install" | "unsupported";

export function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS reports itself as a Mac, but a touch-capable one.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function notifySupport(): NotifySupport {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) {
    return isIosDevice() && !isStandaloneApp() ? "needs-install" : "unsupported";
  }
  return "supported";
}

export function notifyPermission(): NotificationPermission | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  return Notification.permission;
}

export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/**
 * Mobile Chrome throws on `new Notification()`, so prefer the service worker
 * registration and only fall back to the constructor on desktop.
 */
export async function showLocalNotification(
  title: string,
  options: NotificationOptions = {},
) {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const payload: NotificationOptions = {
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    ...options,
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, payload);
        return true;
      }
    }
    new Notification(title, payload);
    return true;
  } catch {
    return false;
  }
}
