import { eq } from "drizzle-orm";
import { ensureSettingsTable, getDb } from "@/db";
import { campSettings } from "@/db/schema";
import {
  sanitizeActivityList,
  type ScoringActivity,
} from "@/lib/scoring";

export const SCORING_SETTING_KEY = "scoring-activities";

/**
 * The scoring caps, shared by every device.
 *
 * Returns null when nothing has been saved yet, so the caller can fall back to
 * the list suggested from the schedule rather than showing an empty screen.
 */
export async function getScoringActivities(): Promise<ScoringActivity[] | null> {
  await ensureSettingsTable();
  const db = getDb();
  const [row] = await db
    .select()
    .from(campSettings)
    .where(eq(campSettings.key, SCORING_SETTING_KEY))
    .limit(1);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as unknown;
    const clean = sanitizeActivityList(parsed);
    return clean.length ? clean : null;
  } catch {
    return null;
  }
}

export async function saveScoringActivities(activities: ScoringActivity[]) {
  await ensureSettingsTable();
  const db = getDb();
  const value = JSON.stringify(activities);
  await db
    .insert(campSettings)
    .values({ key: SCORING_SETTING_KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: campSettings.key,
      set: { value, updatedAt: new Date() },
    });
}
