// @vitest-environment node

import { describe, expect, it } from "vitest";
import { DatabaseRateLimiter } from "@/lib/server/security/rate-limit";
import { testDatabase } from "@/tests/helpers/postgres";

describe("DatabaseRateLimiter", () => {
  it("atomically rejects requests above a policy limit", async () => {
    const { db } = await testDatabase();
    const limiter = new DatabaseRateLimiter(db);
    const now = new Date("2026-09-07T00:00:30Z");
    const results = await Promise.all(Array.from({ length: 5 }, () => limiter.consume("user-a", "vault", { limit: 3, windowMs: 60_000 }, now)));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(results.filter((allowed) => !allowed)).toHaveLength(2);
  });

  it("isolates subjects and scopes and resets in the next window", async () => {
    const { db } = await testDatabase();
    const limiter = new DatabaseRateLimiter(db);
    const policy = { limit: 1, windowMs: 60_000 };
    const now = new Date("2026-09-07T00:00:30Z");
    await expect(limiter.consume("user-a", "write", policy, now)).resolves.toBe(true);
    await expect(limiter.consume("user-a", "write", policy, now)).resolves.toBe(false);
    await expect(limiter.consume("user-b", "write", policy, now)).resolves.toBe(true);
    await expect(limiter.consume("user-a", "read", policy, now)).resolves.toBe(true);
    await expect(limiter.consume("user-a", "write", policy, new Date("2026-09-07T00:01:00Z"))).resolves.toBe(true);
  });

  it("stores only a derived subject/scope hash", async () => {
    const { client, db } = await testDatabase();
    const limiter = new DatabaseRateLimiter(db);
    await limiter.consume("sensitive-user-id", "vault-write", { limit: 1, windowMs: 60_000 });
    const result = await client.query<{ key_hash: string }>("select key_hash from rate_limit_buckets");
    expect(result.rows[0].key_hash).not.toContain("sensitive-user-id");
    expect(result.rows[0].key_hash).not.toContain("vault-write");
  });
});
