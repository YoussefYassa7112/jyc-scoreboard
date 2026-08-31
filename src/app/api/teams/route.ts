import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { ensureCabinColumn, getDb } from "@/db";
import { pointEvents, teams, type CampGroup } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { cabinFitsGroup, parseCabinId } from "@/lib/cabins";
import { invalidateStandingsCache, TEAM_COLORS } from "@/lib/standings";

export const dynamic = "force-dynamic";

function parseCampGroup(value: unknown): CampGroup | null {
  if (value === "red" || value === "green") return value;
  return null;
}

export async function GET() {
  // Staff-only: exposes cabin assignments and the staff names attached to them.
  // Campers read the roster through /api/standings, which carries no such
  // detail. Only the admin dashboard calls this.
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensureCabinColumn();
    const db = getDb();
    const rows = await db
      .select({
        id: teams.id,
        name: teams.name,
        color: teams.color,
        campGroup: teams.campGroup,
        cabinId: teams.cabinId,
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
        teams.cabinId,
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
    await ensureCabinColumn();
    const body = (await request.json()) as {
      name?: string;
      color?: string;
      campGroup?: string;
      cabinId?: number | null;
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

    const cabinId = parseCabinId(body.cabinId);
    if (Number.isNaN(cabinId)) {
      return NextResponse.json({ error: "Invalid cabin" }, { status: 400 });
    }
    if (cabinId != null && !cabinFitsGroup(cabinId, campGroup)) {
      return NextResponse.json(
        { error: "That cabin is not in the selected group" },
        { status: 400 },
      );
    }

    const db = getDb();
    // Cabins are shared. Several teams sleep in the same one, so the only rule
    // left is that the cabin belongs to the team's group, checked above.

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
        cabinId: cabinId ?? null,
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
