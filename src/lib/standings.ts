import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb, ensureCabinColumn } from "@/db";
import { getMessages, type CampMessageRow } from "@/lib/messages";
import { pointEvents, teams } from "@/db/schema";

export type StandingRow = {
  id: number;
  name: string;
  color: string;
  score: number;
  rank: number;
  campGroup: "red" | "green" | null;
  cabinId?: number | null;
};

type StandingsPayload = {
  standings: StandingRow[];
  /**
   * Camp-wide notices ride along with the standings rather than getting their
   * own polled endpoint. The board already asks for this payload on a timer,
   * so this adds no requests and reuses the same cache and ETag — a second
   * endpoint on its own interval would have doubled the invocation count for
   * data that changes a handful of times a weekend.
   */
  messages: CampMessageRow[];
  asOf: string;
};

/**
 * ~1s in-memory TTL: 100 phones can poll every second and still share one
 * Neon query per isolate. Pair with a 1s CDN cache and 304s on unchanged rev.
 */
const STANDINGS_TTL_MS = 800;
let standingsCache: { at: number; data: StandingsPayload } | null = null;

export function invalidateStandingsCache() {
  standingsCache = null;
}

/**
 * Fingerprint of exactly what the client would receive.
 *
 * This used to be `maxEventId:teamCount:maxTeamId:cabinSum` from its own query,
 * which was both an extra round trip and wrong: renaming a team or changing its
 * colour moves none of those numbers, so the ETag never changed and campers
 * kept a 304 forever. Two teams swapping cabins also kept the same cabinSum.
 * Hashing the payload instead is correct by construction, and it is cheaper —
 * it reuses the 800ms standings cache rather than issuing a second query.
 */
function revisionOf(data: StandingsPayload): string {
  let hash = 5381;
  const canonical = [
    data.standings
      .map(
        (r) =>
          `${r.id}:${r.name}:${r.color}:${r.score}:${r.campGroup ?? ""}:${r.cabinId ?? ""}`,
      )
      .join("|"),
    // Notices are part of what the client renders, so a new one has to move the
    // revision or campers would sit on a 304 and never see it.
    data.messages.map((m) => `${m.id}:${m.pinned ? 1 : 0}:${m.body}`).join("|"),
  ].join("#");
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) + hash + canonical.charCodeAt(i)) | 0;
  }
  return `${data.standings.length}-${(hash >>> 0).toString(36)}`;
}

export async function getStandingsRevision(): Promise<string> {
  return revisionOf(await getStandingsCached());
}

export async function getStandingsCached(): Promise<StandingsPayload> {
  if (standingsCache && Date.now() - standingsCache.at < STANDINGS_TTL_MS) {
    return standingsCache.data;
  }
  const data = await getStandings();
  standingsCache = { at: Date.now(), data };
  return data;
}

export async function getStandings(): Promise<StandingsPayload> {
  await ensureCabinColumn();
  const db = getDb();

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      color: teams.color,
      campGroup: teams.campGroup,
      cabinId: teams.cabinId,
      score: sql<number>`coalesce(sum(${pointEvents.delta}), 0)`.mapWith(Number),
    })
    .from(teams)
    .leftJoin(pointEvents, eq(pointEvents.teamId, teams.id))
    .groupBy(
      teams.id,
      teams.name,
      teams.color,
      teams.campGroup,
      teams.cabinId,
      teams.createdAt,
    )
    .orderBy(
      desc(sql`coalesce(sum(${pointEvents.delta}), 0)`),
      asc(teams.name),
      asc(teams.createdAt),
    );

  // Fetched alongside the roster; both land inside the same 800ms cache window.
  const messages = await getMessages();

  const standings: StandingRow[] = rows.map((row, index) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    score: row.score,
    rank: index + 1,
    campGroup: row.campGroup ?? null,
    cabinId: row.cabinId ?? null,
  }));

  return {
    standings,
    messages,
    asOf: new Date().toISOString(),
  };
}

export async function getPointHistory(limit = 250) {
  const db = getDb();
  return db
    .select({
      id: pointEvents.id,
      teamId: pointEvents.teamId,
      teamName: teams.name,
      teamColor: teams.color,
      delta: pointEvents.delta,
      note: pointEvents.note,
      createdAt: pointEvents.createdAt,
    })
    .from(pointEvents)
    .innerJoin(teams, eq(teams.id, pointEvents.teamId))
    .orderBy(desc(pointEvents.createdAt))
    .limit(limit);
}

export const TEAM_COLORS = [
  "#C45C26", // woody brown/orange
  "#1E6BB8", // buzz blue
  "#E8B923", // sun yellow
  "#2F8F4E", // grass green
  "#8B3A4A", // Jessie red
  "#F5F0E6", // cloudy white (will use dark text)
  "#5C4033", // saddle brown
  "#4A90A4", // sky teal
];
