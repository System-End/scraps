import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

import { usersTable } from "./users";

export const projectsTable = pgTable("projects", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').notNull().references(() => usersTable.id),

  name: varchar().notNull(),
  description: varchar().notNull(),
  
  imageUrl: varchar().notNull(),
  githubUrl: varchar().notNull(),

    
  hours: integer().notNull(),

  hackatimeUrl: varchar().notNull()
});

// last ship date
// what we can improve
// first ship date
// github repository

// under review

// current_hours
// approved_hours
