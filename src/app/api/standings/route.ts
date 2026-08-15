import { NextResponse } from "next/server";
import { getStandingsCached } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getStandingsCached();
    return NextResponse.json(data, {
      headers: {
        // Edge + browser reuse: 100 campers should not each hit Neon.
        "Cache-Control": "public, max-age=4, s-maxage=5, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("standings error", error);
    return NextResponse.json(
      { error: "Failed to load standings" },
      { status: 500 },
    );
  }
}
