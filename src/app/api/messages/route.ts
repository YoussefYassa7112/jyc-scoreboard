import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  MESSAGE_MAX_LENGTH,
  createMessage,
  getMessages,
} from "@/lib/messages";
import { invalidateStandingsCache } from "@/lib/standings";

export const dynamic = "force-dynamic";

/**
 * Staff-only. Campers do not call this — notices reach them inside the
 * standings payload, which they are already polling.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ messages: await getMessages() });
  } catch (error) {
    console.error("messages list error", error);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { body?: string; pinned?: boolean };
    const text = body.body?.trim();
    if (!text) {
      return NextResponse.json(
        { error: "Write a message first" },
        { status: 400 },
      );
    }
    if (text.length > MESSAGE_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Keep it under ${MESSAGE_MAX_LENGTH} characters` },
        { status: 400 },
      );
    }

    const message = await createMessage(text, body.pinned === true);
    // Notices ride in the standings payload, so the cached copy is now stale.
    invalidateStandingsCache();

    return NextResponse.json(
      {
        message: {
          ...message,
          pinned: message.pinned === 1,
          createdAt: message.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("create message error", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
