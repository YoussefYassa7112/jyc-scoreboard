import { NextResponse } from "next/server";
import { createAdminSession, verifyAdminPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * One shared, human-chosen camp password guarded nothing but an unlimited
 * number of guesses. This is a per-isolate sliding window — serverless means it
 * is not a hard cap, but it turns an unattended online brute force into
 * something far slower without ever getting in a counselor's way.
 */
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 60_000;
const attempts = new Map<string, number[]>();

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  // Bound the map so a stream of spoofed IPs cannot grow it without limit.
  if (attempts.size > 500) {
    for (const [k, v] of attempts) {
      if (v.every((t) => now - t >= WINDOW_MS)) attempts.delete(k);
    }
  }
  return recent.length > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (tooManyAttempts(ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Wait a minute and try again." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const body = (await request.json()) as { password?: string };
    const password = body.password ?? "";

    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    await createAdminSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("login error", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
