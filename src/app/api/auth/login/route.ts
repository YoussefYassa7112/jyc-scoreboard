import { NextResponse } from "next/server";
import { createAdminSession, verifyAdminPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
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
