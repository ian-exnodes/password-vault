import { and, eq, lt, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { rateLimitBuckets, type schema } from "@/lib/server/db/schema";

type RateLimitDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export interface RateLimiter {
  consume(subject: string, scope: string, policy?: RateLimitPolicy, now?: Date): Promise<boolean>;
}

export const VAULT_MUTATION_POLICY = Object.freeze({ limit: 120, windowMs: 60_000 });

async function hashKey(value: string): Promise<string> {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("base64url");
}

export class DatabaseRateLimiter implements RateLimiter {
  constructor(private readonly db: RateLimitDatabase) {}

  async consume(subject: string, scope: string, policy: RateLimitPolicy = VAULT_MUTATION_POLICY, now = new Date()): Promise<boolean> {
    if (!Number.isInteger(policy.limit) || policy.limit < 1 || !Number.isInteger(policy.windowMs) || policy.windowMs < 1_000) throw new Error("Invalid rate-limit policy");
    const windowStartedAt = new Date(Math.floor(now.getTime() / policy.windowMs) * policy.windowMs);
    const keyHash = await hashKey(`${scope}\u0000${subject}`);
    const rows = await this.db.insert(rateLimitBuckets).values({ keyHash, windowStartedAt, expiresAt: new Date(windowStartedAt.getTime() + policy.windowMs * 2) })
      .onConflictDoUpdate({
        target: [rateLimitBuckets.keyHash, rateLimitBuckets.windowStartedAt],
        set: { count: sql`${rateLimitBuckets.count} + 1` },
        setWhere: and(eq(rateLimitBuckets.keyHash, keyHash), lt(rateLimitBuckets.count, policy.limit)),
      }).returning({ count: rateLimitBuckets.count });
    return rows.length === 1 && rows[0].count <= policy.limit;
  }
}
