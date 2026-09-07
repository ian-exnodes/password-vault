// @vitest-environment node

import { describe, expect, it } from "vitest";
import { users, vaults } from "@/lib/server/db/schema";
import { SessionService } from "@/lib/server/auth/session";
import { VaultHttpApi } from "@/lib/server/vault/http";
import { VaultRepository } from "@/lib/server/vault/repository";
import { testDatabase } from "@/tests/helpers/postgres";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const VAULT_A = "10000000-0000-4000-8000-000000000001";
const VAULT_B = "10000000-0000-4000-8000-000000000002";
const ITEM = "20000000-0000-4000-8000-000000000001";
const FOREIGN_ITEM = "20000000-0000-4000-8000-000000000002";
const NONCE = "AAAAAAAAAAAAAAAA";
const CIPHERTEXT = "AAAAAAAAAAAAAAAAAAAAAAA";
const keyEnvelope = { format: "password-vault-key-envelope", version: 1, purpose: "master", kdf: { name: "argon2id", version: 19, salt: "AAAAAAAAAAAAAAAAAAAAAA", memoryKiB: 19456, iterations: 2, parallelism: 1 }, cipher: { name: "aes-256-gcm", nonce: NONCE, tagBits: 128 }, ciphertext: "A".repeat(64) } as const;

function cookiePair(value: string) { return value.split(";", 1)[0]; }

async function setup() {
  const { db } = await testDatabase();
  await db.insert(users).values([{ id: USER_A, email: "a@example.test" }, { id: USER_B, email: "b@example.test" }]);
  await db.insert(vaults).values([
    { id: VAULT_A, userId: USER_A, masterEnvelope: keyEnvelope, recoveryEnvelope: { ...keyEnvelope, purpose: "recovery", kdf: { name: "hkdf-sha256", salt: "AAAAAAAAAAAAAAAAAAAAAA" } }, cryptoVersion: 1 },
    { id: VAULT_B, userId: USER_B, masterEnvelope: keyEnvelope, recoveryEnvelope: { ...keyEnvelope, purpose: "recovery", kdf: { name: "hkdf-sha256", salt: "AAAAAAAAAAAAAAAAAAAAAA" } }, cryptoVersion: 1 },
  ]);
  const sessions = new SessionService(db);
  const issued = await sessions.issue(USER_A, "Test device");
  const cookie = `${cookiePair(issued.sessionCookie)}; ${cookiePair(issued.csrfCookie)}`;
  const repository = new VaultRepository(db);
  const api = new VaultHttpApi(repository, sessions);
  const request = (method: string, body?: unknown) => new Request("https://vault.example/api/v1/vault/items", {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { cookie, origin: "https://vault.example", "x-csrf-token": issued.csrfToken, ...(body === undefined ? {} : { "content-type": "application/json" }) },
  });
  return { api, repository, request, sessions };
}

function item(vaultId = VAULT_A, revision = 1, itemId = ITEM) {
  return { format: "password-vault-item", version: 1, vaultId, itemId, revision, cipher: { name: "aes-256-gcm", nonce: NONCE, tagBits: 128 }, ciphertext: CIPHERTEXT };
}

describe("VaultHttpApi", () => {
  it("accepts encrypted fields only and returns no-store responses", async () => {
    const { api, request } = await setup();
    const created = await api.create(request("POST", item()));
    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("no-store");
    const createdBody = await created.json();
    expect(Object.keys(createdBody.item).sort()).toEqual(["cipher", "ciphertext", "format", "itemId", "revision", "vaultId", "version"]);
    const listed = await api.list(request("GET"));
    expect(await listed.json()).toMatchObject({ items: [{ itemId: ITEM, vaultId: VAULT_A, revision: 1 }] });
  });

  it("rejects plaintext or unknown request fields", async () => {
    const { api, request } = await setup();
    const response = await api.create(request("POST", { ...item(), password: "plaintext" }));
    expect(response.status).toBe(400);
  });

  it("does not create under a foreign vault and does not disclose it", async () => {
    const { api, request } = await setup();
    const response = await api.create(request("POST", item(VAULT_B)));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("returns the same 404 for foreign get, update, and delete operations", async () => {
    const { api, repository, request } = await setup();
    await repository.createItem(USER_B, VAULT_B, { id: FOREIGN_ITEM, ciphertext: CIPHERTEXT, nonce: NONCE, cryptoVersion: 1, revision: 1 });
    expect((await api.get(request("GET"), FOREIGN_ITEM)).status).toBe(404);
    expect((await api.update(request("PUT", { expectedRevision: 1, item: item(VAULT_B, 2, FOREIGN_ITEM) }), FOREIGN_ITEM)).status).toBe(404);
    expect((await api.delete(request("DELETE", { expectedRevision: 1 }), FOREIGN_ITEM)).status).toBe(404);
    await expect(repository.getItem(USER_B, FOREIGN_ITEM)).resolves.toMatchObject({ revision: 1 });
  });

  it("returns an explicit conflict for stale revisions", async () => {
    const { api, request } = await setup();
    expect((await api.create(request("POST", item()))).status).toBe(201);
    const updated = await api.update(request("PUT", { expectedRevision: 1, item: item(VAULT_A, 2) }), ITEM);
    expect(updated.status).toBe(200);
    const stale = await api.update(request("PUT", { expectedRevision: 1, item: item(VAULT_A, 2) }), ITEM);
    expect(stale.status).toBe(409);
  });

  it("requires authentication and CSRF proof on mutations", async () => {
    const { api } = await setup();
    expect((await api.list(new Request("https://vault.example/api"))).status).toBe(401);
    expect((await api.create(new Request("https://vault.example/api", { method: "POST", body: JSON.stringify(item()), headers: { "content-type": "application/json" } }))).status).toBe(401);
  });

  it("returns 429 before repository mutation when the owner bucket is exhausted", async () => {
    const { repository, request, sessions } = await setup();
    const api = new VaultHttpApi(repository, sessions, { consume: async () => false });
    const response = await api.create(request("POST", item()));
    expect(response.status).toBe(429);
    expect(await repository.listItems(USER_A)).toEqual([]);
  });
});
