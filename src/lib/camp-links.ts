/**
 * Paste the Google Drive folder link between the quotes below and the
 * "Camp photos" button on the scoreboard starts working immediately.
 *
 * Example:
 *   const PHOTOS_URL = "https://drive.google.com/drive/folders/1AbCdEfGhIjK";
 *
 * Who can open it is controlled entirely by the folder's Share settings in
 * Google Drive — no API key, no billing, nothing stored in this app.
 *
 * NEXT_PUBLIC_CAMP_PHOTOS_URL overrides this value, so the link can also be
 * set as a Vercel environment variable without touching the code.
 */
const PHOTOS_URL = "";

export const CAMP_PHOTOS_URL = (
  process.env.NEXT_PUBLIC_CAMP_PHOTOS_URL || PHOTOS_URL
).trim();

export function isSafeExternalUrl(url: string) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
