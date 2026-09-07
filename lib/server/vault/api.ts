import { getDatabase } from "@/lib/server/db/client";
import { SessionService } from "@/lib/server/auth/session";
import { VaultHttpApi } from "@/lib/server/vault/http";
import { VaultRepository } from "@/lib/server/vault/repository";
import { DatabaseRateLimiter } from "@/lib/server/security/rate-limit";

let api: VaultHttpApi | null = null;

export function getVaultHttpApi(): VaultHttpApi {
  if (!api) {
    const database = getDatabase();
    api = new VaultHttpApi(new VaultRepository(database), new SessionService(database), new DatabaseRateLimiter(database));
  }
  return api;
}
