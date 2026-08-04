import { NextResponse } from "next/server";
import { getStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getStandings();
    return NextResponse.json(data);
  } catch (error) {
    console.error("standings error", error);
    return NextResponse.json(
      { error: "Failed to load standings" },
      { status: 500 },
    );
  }
}
