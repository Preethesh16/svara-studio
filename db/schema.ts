import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const operations=sqliteTable('operations',{id:text('id').primaryKey(),owner:text('owner').notNull(),kind:text('kind').notNull(),bucket:text('bucket').notNull(),cents:integer('cents').notNull(),created:integer('created').notNull(),voiceId:text('voice_id')});
export const attempts=sqliteTable('attempts',{id:integer('id').primaryKey({autoIncrement:true}),owner:text('owner').notNull(),created:integer('created').notNull()});
export const websites=sqliteTable('websites',{id:text('id').primaryKey(),owner:text('owner').notNull(),published:integer('published').notNull().default(0)});
