import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { deleteMessage, setMessagePinned } from "@/lib/messages";
import { invalidateStandingsCache } from "@/lib/standings";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

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
    const body = (await request.json()) as { pinned?: boolean };
    if (typeof body.pinned !== "boolean") {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const row = await setMessagePinned(id, body.pinned);
    if (!row) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    invalidateStandingsCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("pin message error", error);
    return NextResponse.json(
      { error: "Failed to update message" },
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
    const removed = await deleteMessage(id);
    if (!removed) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    invalidateStandingsCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete message error", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 },
    );
  }
}
