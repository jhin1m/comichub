import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// notifications — polymorphic (notifiable_type: user), event-driven
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    notifiableType: varchar('notifiable_type', { length: 50 }).notNull(),
    notifiableId: integer('notifiable_id').notNull(),
    type: varchar('type', { length: 100 }).notNull(),
    data: jsonb('data').notNull(),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('notifications_notifiable_idx').on(
      table.notifiableType,
      table.notifiableId,
    ),
    index('notifications_read_at_idx').on(table.readAt),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
