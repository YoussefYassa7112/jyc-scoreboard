import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Camp schedule track: red or green group */
export type CampGroup = "red" | "green";

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#F4C430"),
  /** Which schedule track this team follows */
  campGroup: text("camp_group").$type<CampGroup>(),
  /** Which cabin this team sleeps in — unique across teams when set */
  cabinId: integer("cabin_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pointEvents = pgTable("point_events", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Camp-wide announcements written by staff and shown to everyone.
 * `pinned` keeps a notice at the top of the camper board until it is unpinned.
 */
export const campMessages = pgTable("camp_messages", {
  id: serial("id").primaryKey(),
  body: text("body").notNull(),
  pinned: integer("pinned").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Team = typeof teams.$inferSelect;
export type PointEvent = typeof pointEvents.$inferSelect;
export type CampMessage = typeof campMessages.$inferSelect;
