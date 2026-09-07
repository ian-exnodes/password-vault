import { check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { KeyEnvelope } from "@/lib/crypto/core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  status: text("status").notNull().default("enabled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
  check("users_status_check", sql`${table.status} in ('enabled', 'disabled')`),
]);

export const vaults = pgTable("vaults", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  masterEnvelope: jsonb("master_envelope").$type<KeyEnvelope>().notNull(),
  recoveryEnvelope: jsonb("recovery_envelope").$type<KeyEnvelope>().notNull(),
  cryptoVersion: integer("crypto_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("vaults_user_id_unique").on(table.userId),
  check("vaults_crypto_version_check", sql`${table.cryptoVersion} > 0`),
]);

export const vaultItems = pgTable("vault_items", {
  id: uuid("id").primaryKey(),
  vaultId: uuid("vault_id").notNull().references(() => vaults.id, { onDelete: "cascade" }),
  ciphertext: text("ciphertext").notNull(),
  nonce: text("nonce").notNull(),
  cryptoVersion: integer("crypto_version").notNull(),
  revision: integer("revision").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("vault_items_vault_id_id_unique").on(table.vaultId, table.id),
  index("vault_items_vault_updated_idx").on(table.vaultId, table.updatedAt),
  check("vault_items_crypto_version_check", sql`${table.cryptoVersion} > 0`),
  check("vault_items_revision_check", sql`${table.revision} > 0`),
  check("vault_items_nonce_length_check", sql`char_length(${table.nonce}) = 16`),
  check("vault_items_ciphertext_length_check", sql`char_length(${table.ciphertext}) between 23 and 1398102`),
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  csrfTokenHash: text("csrf_token_hash").notNull(),
  deviceName: text("device_name").notNull(),
  idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
  index("sessions_user_id_idx").on(table.userId),
]);

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  keyHash: text("key_hash").notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.keyHash, table.windowStartedAt] }),
  index("rate_limit_buckets_expiry_idx").on(table.expiresAt),
  check("rate_limit_buckets_count_check", sql`${table.count} > 0`),
]);

export const schema = { users, vaults, vaultItems, sessions, rateLimitBuckets };
