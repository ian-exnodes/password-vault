import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { schema } from "@/lib/server/db/schema";

let database: ReturnType<typeof createDatabase> | null = null;

function createDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for vault API requests");
  const client = postgres(url, { max: 10, prepare: false });
  return drizzle(client, { schema });
}

export function getDatabase() {
  database ??= createDatabase();
  return database;
}
