import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { Block } from '../types';
import { SearchSources } from '../agents/search/types';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  messageId: text('messageId').notNull(),
  chatId: text('chatId').notNull(),
  backendId: text('backendId').notNull(),
  query: text('query').notNull(),
  createdAt: text('createdAt').notNull(),
  responseBlocks: text('responseBlocks', { mode: 'json' })
    .$type<Block[]>()
    .default(sql`'[]'`),
  status: text({ enum: ['answering', 'completed', 'error'] }).default(
    'answering',
  ),
});

interface DBFile {
  name: string;
  fileId: string;
}

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  sources: text('sources', {
    mode: 'json',
  })
    .$type<SearchSources[]>()
    .default(sql`'[]'`),
  files: text('files', { mode: 'json' })
    .$type<DBFile[]>()
    .default(sql`'[]'`),
});

export const dspyFunctions = sqliteTable('dspy_functions', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  inputSchemaJson: text('inputSchemaJson', { mode: 'json' }).notNull(),
  outputSchemaJson: text('outputSchemaJson', { mode: 'json' }).notNull(),
  moduleType: text({ enum: ['ChainOfThought', 'PredictModule'] }).notNull(),
  instructions: text('instructions').notNull(),
  userPromptTemplate: text('userPromptTemplate').notNull(),
  formatterType: text('formatterType').notNull(),
  safetyJson: text('safetyJson', { mode: 'json' }).default(sql`'{}'`),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});
