"use client";

/**
 * A local marker that this device signed in as staff.
 *
 * This is NOT the session. The session is the httpOnly `camp_admin_session`
 * cookie, and every route that reads or writes camp data still verifies it on
 * the server — a counselor who forges this flag gets the dashboard shell and a
 * 401 from everything in it.
 *
 * What it buys is the offline case. `/admin` used to be server-rendered behind
 * `isAdminAuthenticated()`, so with no connection the request never reached the
 * server, the service worker served the offline fallback, and staff were bounced
 * to a login screen they could not use without WiFi — locking them out of the
 * field notes, which are the one part of the dashboard that works offline by
 * design. With this flag the shell opens from cache and the offline features
 * keep working; anything needing the network still says "Needs WiFi".
 */

const KEY = "camp-admin-signed-in";

export function markAdminSignedIn() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* private mode */
  }
}

export function clearAdminSignedIn() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

export function wasAdminSignedIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
