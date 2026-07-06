import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uuid,
  varchar,
  integer,
  uniqueIndex,
  unique,
} from 'drizzle-orm/pg-core';

/* start of better-auth */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
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
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
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
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
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

export enum PartOfSpeech {
  Adjective = 'adjective',
  Adverb = 'adverb',
  AuxiliaryVerb = 'auxiliary-verb',
  Conjunction = 'conjunction',
  DefiniteArticle = 'definite-article',
  Determiner = 'determiner',
  Exclamation = 'exclamation',
  IndefiniteArticle = 'indefinite-article',
  InfinitiveMarker = 'infinitive-marker',
  LinkingVerb = 'linking-verb',
  ModalVerb = 'modal-verb',
  Noun = 'noun',
  Number = 'number',
  OrdinalNumber = 'ordinal-number',
  Preposition = 'preposition',
  Pronoun = 'pronoun',
  Verb = 'verb',
}

export enum LearningStatus {
  Waiting = 'waiting',
  Learning = 'learning',
  Learned = 'learned',
  Known = 'known',
}

export const vocabularyItem = pgTable(
  'vocabulary_item',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    value: varchar('value', { length: 255 }).notNull(),
    definition: varchar('definition', { length: 512 }).notNull(),
    uaTranslation: varchar('ua_translation', { length: 255 }).notNull(),
    partOfSpeech: varchar('part_of_speech', { length: 32 }).$type<PartOfSpeech>(),
    spelling: varchar('spelling', { length: 255 }).notNull(),
    pronunciation: varchar('pronunciation', { length: 512 }),
    link: varchar('link', { length: 512 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // seeding dedup key: nullsNotDistinct so two rows with the same value and no part of speech (e.g. phrases) also conflict
    unique('vocabulary_item_value_part_of_speech_idx').on(table.value, table.partOfSpeech).nullsNotDistinct(),
  ],
);

export const vocabularyList = pgTable('vocabulary_list', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const vocabularyListItem = pgTable(
  'vocabulary_list_item',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vocabularyListId: uuid('vocabulary_list_id')
      .notNull()
      .references(() => vocabularyList.id, { onDelete: 'cascade' }),
    vocabularyItemId: uuid('vocabulary_item_id')
      .notNull()
      .references(() => vocabularyItem.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // data integrity: prevents adding the same item to the same list twice
    uniqueIndex('vocabulary_list_item_vocabulary_list_id_vocabulary_item_id_idx').on(
      table.vocabularyListId,
      table.vocabularyItemId,
    ),
    // join performance: speeds up "which lists contain this item" lookups
    index('vocabulary_list_item_vocabulary_item_id_idx').on(table.vocabularyItemId),
  ],
);

export const userVocabularyItem = pgTable(
  'user_vocabulary_item',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    vocabularyItemId: uuid('vocabulary_item_id')
      .notNull()
      .references(() => vocabularyItem.id, { onDelete: 'restrict' }),
    encounterCount: integer('encounter_count').default(0).notNull(),
    status: varchar('status', { length: 16 }).$type<LearningStatus>().default(LearningStatus.Waiting).notNull(),
    enqueuedAt: timestamp('enqueued_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // data integrity: prevents duplicate progress rows for the same user + item
    uniqueIndex('user_vocabulary_item_user_id_vocabulary_item_id_idx').on(table.userId, table.vocabularyItemId),
    // join performance: speeds up "which users have progress on this item" lookups
    index('user_vocabulary_item_vocabulary_item_id_idx').on(table.vocabularyItemId),
  ],
);

export const vocabularyListRelations = relations(vocabularyList, ({ many }) => ({
  vocabularyListItems: many(vocabularyListItem),
}));

export const vocabularyItemRelations = relations(vocabularyItem, ({ many }) => ({
  vocabularyListItems: many(vocabularyListItem),
  userVocabularyItems: many(userVocabularyItem),
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

export const userVocabularyItemRelations = relations(userVocabularyItem, ({ one }) => ({
  user: one(user, {
    fields: [userVocabularyItem.userId],
    references: [user.id],
  }),
  vocabularyItem: one(vocabularyItem, {
    fields: [userVocabularyItem.vocabularyItemId],
    references: [vocabularyItem.id],
  }),
}));
