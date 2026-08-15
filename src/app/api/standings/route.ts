import { NextResponse } from "next/server";
import { getStandingsCached, getStandingsRevision } from "@/lib/standings";

export const dynamic = "force-dynamic";

const CACHE_CONTROL =
  "public, max-age=0, s-maxage=1, stale-while-revalidate=3";

export async function GET(request: Request) {
  try {
    const rev = await getStandingsRevision();
    const etag = `"${rev}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": CACHE_CONTROL,
        },
      });
    }

    const data = await getStandingsCached();
    return NextResponse.json(
      { ...data, rev },
      {
        headers: {
          ETag: etag,
          "Cache-Control": CACHE_CONTROL,
        },
      },
    );
  } catch (error) {
    console.error("standings error", error);
    return NextResponse.json(
      { error: "Failed to load standings" },
      { status: 500 },
    );
  }
}
