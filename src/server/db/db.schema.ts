import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uuid,
  varchar,
  integer,
  bigint,
  uniqueIndex,
  unique,
  jsonb,
  check,
} from 'drizzle-orm/pg-core';
import { LearningStatus, PartOfSpeech, VocabularyListType } from '@/const/vocabulary';
import { EventType, UserVocabularyItemTaskType } from '@/const/event';

/* start of better-auth */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  userVocabularyItems: many(userVocabularyItem),
  userVocabularyLists: many(userVocabularyList),
  events: many(event),
  ownedVocabularyLists: many(vocabularyList),
  files: many(file),
  readings: many(reading),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
/* end of better-auth */

export const vocabularyItem = pgTable(
  'vocabulary_item',
  {
    id: uuid('id')
      .default(sql`uuidv7()`)
      .primaryKey(),
    value: varchar('value', { length: 255 }).notNull(),
    definition: varchar('definition', { length: 512 }).notNull(),
    uaTranslation: varchar('ua_translation', { length: 255 }).notNull(),
    partOfSpeech: varchar('part_of_speech', { length: 32 }).$type<PartOfSpeech>(),
    spelling: varchar('spelling', { length: 255 }).notNull(),
    pronunciation: varchar('pronunciation', { length: 512 }),
    link: varchar('link', { length: 512 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // seeding dedup key: nullsNotDistinct so two rows with the same value and no part of speech (e.g. phrases) also conflict
    unique('vocabulary_item_value_part_of_speech_idx').on(table.value, table.partOfSpeech).nullsNotDistinct(),
  ],
);

export const vocabularyList = pgTable(
  'vocabulary_list',
  {
    id: uuid('id')
      .default(sql`uuidv7()`)
      .primaryKey(),
    ownerId: text('owner_id').references(() => user.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 16 }).$type<VocabularyListType>().notNull().default(VocabularyListType.Public),
    title: varchar('title', { length: 255 }).unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // data integrity: at most one personal list per user
    uniqueIndex('vocabulary_list_owner_id_personal_idx')
      .on(table.ownerId)
      .where(sql`${table.type} = ${sql.raw(`'${VocabularyListType.Personal}'`)}`),
    check(
      'vocabulary_list_personal_owner_id_check',
      sql`${table.type} != ${sql.raw(`'${VocabularyListType.Personal}'`)} OR ${table.ownerId} IS NOT NULL`,
    ),
    check(
      'vocabulary_list_public_title_check',
      sql`${table.type} != ${sql.raw(`'${VocabularyListType.Public}'`)} OR ${table.title} IS NOT NULL`,
    ),
  ],
);

export const vocabularyListItem = pgTable(
  'vocabulary_list_item',
  {
    id: uuid('id')
      .default(sql`uuidv7()`)
      .primaryKey(),
    vocabularyListId: uuid('vocabulary_list_id')
      .notNull()
      .references(() => vocabularyList.id, { onDelete: 'cascade' }),
    vocabularyItemId: uuid('vocabulary_item_id')
      .notNull()
      .references(() => vocabularyItem.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // data integrity: prevents adding the same item to the same list twice, also improves join performance
    uniqueIndex('vocabulary_list_item_vocabulary_list_id_vocabulary_item_id_idx').on(
      table.vocabularyListId,
      table.vocabularyItemId,
    ),
  ],
);

export const userVocabularyItem = pgTable(
  'user_vocabulary_item',
  {
    id: uuid('id')
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    vocabularyItemId: uuid('vocabulary_item_id')
      .notNull()
      .references(() => vocabularyItem.id, { onDelete: 'restrict' }),
    encounterCount: integer('encounter_count').default(0).notNull(),
    status: varchar('status', { length: 16 }).$type<LearningStatus>().default(LearningStatus.Waiting).notNull(),
    enqueuedAt: timestamp('enqueued_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // data integrity: prevents duplicate progress rows for the same user + item, also improves join performance
    uniqueIndex('user_vocabulary_item_user_id_vocabulary_item_id_idx').on(table.userId, table.vocabularyItemId),
  ],
);

export const userVocabularyList = pgTable(
  'user_vocabulary_list',
  {
    id: uuid('id')
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    vocabularyListId: uuid('vocabulary_list_id')
      .notNull()
      .references(() => vocabularyList.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // data integrity: prevents adding the same list to the same user twice, also improves join performance
    uniqueIndex('user_vocabulary_list_user_id_vocabulary_list_id_idx').on(table.userId, table.vocabularyListId),
  ],
);

export const file = pgTable(
  'file',
  {
    id: uuid('id')
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    filePath: text('file_path').notNull(),
    mimeType: varchar('mime_type', { length: 64 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    hash: varchar('hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // data integrity: prevents the same user from uploading the same file twice
    uniqueIndex('file_user_id_hash_idx').on(table.userId, table.hash),
  ],
);

export const reading = pgTable('reading', {
  id: uuid('id')
    .default(sql`uuidv7()`)
    .primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  fileId: uuid('file_id')
    .notNull()
    .unique()
    .references(() => file.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  totalPages: integer('total_pages').notNull(),
  currentPage: integer('current_page').default(0).notNull(),
  durationMs: integer('duration_ms').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const event = pgTable(
  'event',
  {
    id: uuid('id')
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 48 }).$type<EventType>().notNull(),
    userVocabularyItemId: uuid('user_vocabulary_item_id').references(() => userVocabularyItem.id, {
      onDelete: 'restrict',
    }),
    // AI-generation-batch cost tracing: array of user_vocabulary_item ids included in a single generation call
    userVocabularyItemIds: jsonb('user_vocabulary_item_ids').$type<string[]>(),
    vocabularyItemId: uuid('vocabulary_item_id').references(() => vocabularyItem.id, { onDelete: 'restrict' }),
    // exists in vocabulary item update and user vocabulary item progression events
    userVocabularyListId: uuid('user_vocabulary_list_id').references(() => userVocabularyList.id, {
      onDelete: 'restrict',
    }),
    readingId: uuid('reading_id').references(() => reading.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 16 }).$type<LearningStatus>(),
    userVocabularyItemTaskType: varchar('user_vocabulary_item_task_type', {
      length: 48,
    }).$type<UserVocabularyItemTaskType>(),
    // records which vocabulary_item field changed for a vocabulary-item-updated event (e.g. 'uaTranslation')
    fieldName: text('field_name'),
    durationMs: integer('duration_ms'),
    encounterCount: integer('encounter_count'),
    costInNanoDollars: bigint('cost_in_nano_dollars', { mode: 'number' }),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    // marks a discovered event as later undone; generic across event types, not undo-specific
    revertedAt: timestamp('reverted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // statistics page: every query filters by user_id + type; benchmarked against wider indexes, see docs/database-design.md
    index('event_user_id_type_idx').on(table.userId, table.type),
  ],
);

export const vocabularyListRelations = relations(vocabularyList, ({ one, many }) => ({
  vocabularyListItems: many(vocabularyListItem),
  userVocabularyLists: many(userVocabularyList),
  owner: one(user, {
    fields: [vocabularyList.ownerId],
    references: [user.id],
  }),
}));

export const vocabularyItemRelations = relations(vocabularyItem, ({ many }) => ({
  vocabularyListItems: many(vocabularyListItem),
  userVocabularyItems: many(userVocabularyItem),
  events: many(event),
}));

export const vocabularyListItemRelations = relations(vocabularyListItem, ({ one }) => ({
  vocabularyList: one(vocabularyList, {
    fields: [vocabularyListItem.vocabularyListId],
    references: [vocabularyList.id],
  }),
  vocabularyItem: one(vocabularyItem, {
    fields: [vocabularyListItem.vocabularyItemId],
    references: [vocabularyItem.id],
  }),
}));

export const userVocabularyItemRelations = relations(userVocabularyItem, ({ one, many }) => ({
  user: one(user, {
    fields: [userVocabularyItem.userId],
    references: [user.id],
  }),
  vocabularyItem: one(vocabularyItem, {
    fields: [userVocabularyItem.vocabularyItemId],
    references: [vocabularyItem.id],
  }),
  events: many(event),
}));

export const userVocabularyListRelations = relations(userVocabularyList, ({ one, many }) => ({
  user: one(user, {
    fields: [userVocabularyList.userId],
    references: [user.id],
  }),
  vocabularyList: one(vocabularyList, {
    fields: [userVocabularyList.vocabularyListId],
    references: [vocabularyList.id],
  }),
  events: many(event),
}));

export const fileRelations = relations(file, ({ one }) => ({
  user: one(user, {
    fields: [file.userId],
    references: [user.id],
  }),
  reading: one(reading, {
    fields: [file.id],
    references: [reading.fileId],
  }),
}));

export const readingRelations = relations(reading, ({ one, many }) => ({
  user: one(user, {
    fields: [reading.userId],
    references: [user.id],
  }),
  file: one(file, {
    fields: [reading.fileId],
    references: [file.id],
  }),
  events: many(event),
}));
