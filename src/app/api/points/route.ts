import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { pointEvents, teams } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { getPointHistory, invalidateStandingsCache } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET() {
  // Staff-only: point notes are free text written by counselors about campers,
  // and this route was readable by anyone who guessed the URL. Only the admin
  // dashboard ever calls it.
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const history = await getPointHistory(250);
    return NextResponse.json({
      history: history.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("history error", error);
    return NextResponse.json(
      { error: "Failed to load history" },
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
      teamId?: number;
      delta?: number;
      note?: string;
    };

    const teamId = Number(body.teamId);
    const delta = Number(body.delta);

    if (!Number.isFinite(teamId) || !Number.isInteger(delta) || delta === 0) {
      return NextResponse.json(
        { error: "teamId and non-zero integer delta are required" },
        { status: 400 },
      );
    }

    if (Math.abs(delta) > 10000) {
      return NextResponse.json(
        { error: "Delta too large (max ±10000)" },
        { status: 400 },
      );
    }

    const db = getDb();
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const note = body.note?.trim() || null;

    const [event] = await db
      .insert(pointEvents)
      .values({
        teamId,
        delta,
        note,
      })
      .returning();

    invalidateStandingsCache();

    return NextResponse.json(
      {
        event: {
          ...event,
          createdAt: event.createdAt.toISOString(),
          teamName: team.name,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("points error", error);
    return NextResponse.json(
      { error: "Failed to record points" },
      { status: 500 },
    );
  }
}
