import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  avatar: varchar().notNull(),
  username: varchar().notNull(),
  email: varchar().notNull().unique(),

  accessToken: varchar().notNull(),
  refreshToken: varchar().notNull()
});