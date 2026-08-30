import { desc, eq } from "drizzle-orm";
import { ensureMessagesTable, getDb } from "@/db";
import { campMessages } from "@/db/schema";

export type CampMessageRow = {
  id: number;
  body: string;
  pinned: boolean;
  createdAt: string;
};

/** How many notices the board and the admin history keep in view. */
export const MESSAGE_LIMIT = 30;
/** Longest a single notice may be — long enough for detail, short enough to read on a phone. */
export const MESSAGE_MAX_LENGTH = 280;

export async function getMessages(
  limit = MESSAGE_LIMIT,
): Promise<CampMessageRow[]> {
  await ensureMessagesTable();
  const db = getDb();
  const rows = await db
    .select()
    .from(campMessages)
    .orderBy(desc(campMessages.pinned), desc(campMessages.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    pinned: row.pinned === 1,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createMessage(body: string, pinned = false) {
  await ensureMessagesTable();
  const db = getDb();
  const [row] = await db
    .insert(campMessages)
    .values({ body, pinned: pinned ? 1 : 0 })
    .returning();
  return row;
}

export async function deleteMessage(id: number) {
  await ensureMessagesTable();
  const db = getDb();
  const deleted = await db
    .delete(campMessages)
    .where(eq(campMessages.id, id))
    .returning();
  return deleted.length > 0;
}

export async function setMessagePinned(id: number, pinned: boolean) {
  await ensureMessagesTable();
  const db = getDb();
  const [row] = await db
    .update(campMessages)
    .set({ pinned: pinned ? 1 : 0 })
    .where(eq(campMessages.id, id))
    .returning();
  return row ?? null;
}
