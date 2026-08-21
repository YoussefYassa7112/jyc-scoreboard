import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { ensureCabinColumn, getDb } from "@/db";
import { pointEvents, teams, type CampGroup } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { cabinFitsGroup, parseCabinId } from "@/lib/cabins";
import { invalidateStandingsCache } from "@/lib/standings";

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
    await ensureCabinColumn();
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      name?: string;
      color?: string;
      campGroup?: string;
      cabinId?: number | null;
    };

    const db = getDb();
    const [current] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);
    if (!current) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const updates: {
      name?: string;
      color?: string;
      campGroup?: CampGroup;
      cabinId?: number | null;
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
    if (body.cabinId !== undefined) {
      const cabinId = parseCabinId(body.cabinId);
      if (Number.isNaN(cabinId)) {
        return NextResponse.json({ error: "Invalid cabin" }, { status: 400 });
      }
      updates.cabinId = cabinId ?? null;
    }

    const nextGroup = updates.campGroup ?? current.campGroup;
    const nextCabin =
      updates.cabinId !== undefined ? updates.cabinId : current.cabinId;

    if (nextCabin != null && nextGroup && !cabinFitsGroup(nextCabin, nextGroup)) {
      updates.cabinId = null;
    }

    if (updates.cabinId != null) {
      const taken = await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.cabinId, updates.cabinId), ne(teams.id, id)))
        .limit(1);
      if (taken.length) {
        return NextResponse.json(
          { error: "That cabin is already assigned" },
          { status: 400 },
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const [team] = await db
      .update(teams)
      .set(updates)
      .where(eq(teams.id, id))
      .returning();

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    invalidateStandingsCache();

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

    invalidateStandingsCache();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete team error", error);
    return NextResponse.json(
      { error: "Failed to delete team" },
      { status: 500 },
    );
  }
}
