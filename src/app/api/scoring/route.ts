import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { sanitizeActivityList } from "@/lib/scoring";
import { getScoringActivities, saveScoringActivities } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Staff-only. Campers never see the caps — they are an admin tool for deciding
 * how many points an activity is worth, and the awarded totals are what reach
 * the board.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ activities: await getScoringActivities() });
  } catch (error) {
    console.error("scoring read error", error);
    return NextResponse.json(
      { error: "Failed to load scoring setup" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { activities?: unknown };
    const activities = sanitizeActivityList(body.activities);
    if (activities.length === 0) {
      return NextResponse.json(
        { error: "Send at least one activity" },
        { status: 400 },
      );
    }
    await saveScoringActivities(activities);
    return NextResponse.json({ activities });
  } catch (error) {
    console.error("scoring save error", error);
    return NextResponse.json(
      { error: "Failed to save scoring setup" },
      { status: 500 },
    );
  }
}
