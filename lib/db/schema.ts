import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const attendanceLists = pgTable('attendance_lists', {
  id: text('id').primaryKey(),
  listName: text('list_name').notNull(),
  creatorPassword: text('creator_password').notNull(),
  listPassword: text('list_password').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export const attendanceParticipants = pgTable('attendance_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  listId: text('list_id').notNull(),
  fullName: text('full_name').notNull(),
  ipAddress: text('ip_address').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type AttendanceParticipant = typeof attendanceParticipants.$inferSelect
