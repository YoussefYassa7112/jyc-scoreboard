import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { pointEvents, teams, type CampGroup } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { invalidateStandingsCache, TEAM_COLORS } from "@/lib/standings";

export const dynamic = "force-dynamic";

function parseCampGroup(value: unknown): CampGroup | null {
  if (value === "red" || value === "green") return value;
  return null;
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: teams.id,
        name: teams.name,
        color: teams.color,
        campGroup: teams.campGroup,
        sortOrder: teams.sortOrder,
        createdAt: teams.createdAt,
        score: sql<number>`coalesce(sum(${pointEvents.delta}), 0)`.mapWith(
          Number,
        ),
        eventCount: sql<number>`count(${pointEvents.id})`.mapWith(Number),
      })
      .from(teams)
      .leftJoin(pointEvents, eq(pointEvents.teamId, teams.id))
      .groupBy(
        teams.id,
        teams.name,
        teams.color,
        teams.campGroup,
        teams.sortOrder,
        teams.createdAt,
      )
      .orderBy(asc(teams.sortOrder), asc(teams.name));

    return NextResponse.json({ teams: rows });
  } catch (error) {
    console.error("teams list error", error);
    return NextResponse.json(
      { error: "Failed to load teams" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      color?: string;
      campGroup?: string;
    };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const campGroup = parseCampGroup(body.campGroup);
    if (!campGroup) {
      return NextResponse.json(
        { error: "Camp group must be red or green" },
        { status: 400 },
      );
    }

    const db = getDb();
    const existing = await db.select({ id: teams.id }).from(teams);
    const color =
      body.color?.trim() ||
      TEAM_COLORS[existing.length % TEAM_COLORS.length] ||
      "#C45C26";

    const [team] = await db
      .insert(teams)
      .values({
        name,
        color,
        campGroup,
        sortOrder: existing.length,
      })
      .returning();

    invalidateStandingsCache();

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    console.error("create team error", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 },
    );
  }
}
