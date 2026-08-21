import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb, ensureCabinColumn } from "@/db";
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
  asOf: string;
};

/**
 * ~1s in-memory TTL: 100 phones can poll every second and still share one
 * Neon query per isolate. Pair with a 1s CDN cache and 304s on unchanged rev.
 */
const STANDINGS_TTL_MS = 800;
let standingsCache: { at: number; data: StandingsPayload } | null = null;
let revisionCache: { at: number; rev: string } | null = null;

export function invalidateStandingsCache() {
  standingsCache = null;
  revisionCache = null;
}

export async function getStandingsRevision(): Promise<string> {
  if (revisionCache && Date.now() - revisionCache.at < STANDINGS_TTL_MS) {
    return revisionCache.rev;
  }
  await ensureCabinColumn();
  const db = getDb();
  const [row] = await db
    .select({
      maxEventId: sql<number>`coalesce(max(${pointEvents.id}), 0)`.mapWith(
        Number,
      ),
      teamCount: sql<number>`count(distinct ${teams.id})`.mapWith(Number),
      maxTeamId: sql<number>`coalesce(max(${teams.id}), 0)`.mapWith(Number),
      cabinSum: sql<number>`coalesce(sum(${teams.cabinId}), 0)`.mapWith(Number),
    })
    .from(teams)
    .leftJoin(pointEvents, eq(pointEvents.teamId, teams.id));

  const rev = `${row?.maxEventId ?? 0}:${row?.teamCount ?? 0}:${row?.maxTeamId ?? 0}:${row?.cabinSum ?? 0}`;
  revisionCache = { at: Date.now(), rev };
  return rev;
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
