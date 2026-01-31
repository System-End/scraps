import { integer, pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core'

export const usersTable = pgTable('users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  // OIDC identifiers
  sub: varchar().notNull().unique(),
  slackId: varchar('slack_id'),
  
  // Profile info (from Slack)
  username: varchar(),
  email: varchar().notNull(),
  avatar: varchar(),

  // OAuth tokens
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),

  // scraps info
  scraps: integer().notNull().default(0),
  role: varchar().notNull().default('member'),
  internalNotes: text('internal_notes'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})
