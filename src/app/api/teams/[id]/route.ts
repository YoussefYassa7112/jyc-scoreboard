import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { pointEvents, teams, type CampGroup } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

function parseCampGroup(value: unknown): CampGroup | undefined {
  if (value === "red" || value === "green") return value;
  return undefined;
}

export async function PATCH(request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      name?: string;
      color?: string;
      campGroup?: string;
    };

    const updates: {
      name?: string;
      color?: string;
      campGroup?: CampGroup;
    } = {};
    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.color === "string" && body.color.trim()) {
      updates.color = body.color.trim();
    }
    if (body.campGroup !== undefined) {
      const group = parseCampGroup(body.campGroup);
      if (!group) {
        return NextResponse.json(
          { error: "Camp group must be red or green" },
          { status: 400 },
        );
      }
      updates.campGroup = group;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const db = getDb();
    const [team] = await db
      .update(teams)
      .set(updates)
      .where(eq(teams.id, id))
      .returning();

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error("update team error", error);
    return NextResponse.json(
      { error: "Failed to update team" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const db = getDb();

    await db.delete(pointEvents).where(eq(pointEvents.teamId, id));

    const deleted = await db
      .delete(teams)
      .where(eq(teams.id, id))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete team error", error);
    return NextResponse.json(
      { error: "Failed to delete team" },
      { status: 500 },
    );
  }
}
