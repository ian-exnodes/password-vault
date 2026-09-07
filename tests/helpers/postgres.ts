import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { schema } from "@/lib/server/db/schema";

export async function testDatabase() {
  const client = new PGlite();
  for (const migration of ["0000_phase_3_foundation.sql", "0001_secure_sessions.sql", "0002_rate_limits.sql"]) {
    await client.exec(await readFile(new URL(`../../drizzle/${migration}`, import.meta.url), "utf8"));
  }
  return { client, db: drizzle(client, { schema }) };
}
