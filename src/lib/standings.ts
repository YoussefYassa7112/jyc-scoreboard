import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { pointEvents, teams } from "@/db/schema";

export type StandingRow = {
  id: number;
  name: string;
  color: string;
  score: number;
  rank: number;
  campGroup: "red" | "green" | null;
};

type StandingsPayload = {
  standings: StandingRow[];
  asOf: string;
};

/** Short in-memory TTL so ~100 polling phones share one Neon query per isolate. */
const STANDINGS_TTL_MS = 4_000;
let standingsCache: { at: number; data: StandingsPayload } | null = null;

export function invalidateStandingsCache() {
  standingsCache = null;
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
  const db = getDb();

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      color: teams.color,
      campGroup: teams.campGroup,
      score: sql<number>`coalesce(sum(${pointEvents.delta}), 0)`.mapWith(Number),
    })
    .from(teams)
    .leftJoin(pointEvents, eq(pointEvents.teamId, teams.id))
    .groupBy(
      teams.id,
      teams.name,
      teams.color,
      teams.campGroup,
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
  }));

  return {
    standings,
    asOf: new Date().toISOString(),
  };
}

export async function getPointHistory(limit = 50) {
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
