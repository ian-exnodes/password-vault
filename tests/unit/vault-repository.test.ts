// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import { users, vaultItems, vaults } from "@/lib/server/db/schema";
import { VaultRepository } from "@/lib/server/vault/repository";
import { testDatabase } from "@/tests/helpers/postgres";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const VAULT_A = "10000000-0000-4000-8000-000000000001";
const VAULT_B = "10000000-0000-4000-8000-000000000002";
const ITEM_A = "20000000-0000-4000-8000-000000000001";
const ITEM_B = "20000000-0000-4000-8000-000000000002";
const NONCE = "AAAAAAAAAAAAAAAA";
const CIPHERTEXT = "AAAAAAAAAAAAAAAAAAAAAAA";
const envelope = { format: "password-vault-key-envelope", version: 1, purpose: "master", kdf: { name: "argon2id", version: 19, salt: "AAAAAAAAAAAAAAAAAAAAAA", memoryKiB: 19456, iterations: 2, parallelism: 1 }, cipher: { name: "aes-256-gcm", nonce: NONCE, tagBits: 128 }, ciphertext: "A".repeat(64) } as const;

describe("VaultRepository tenant isolation", () => {
  let repository: VaultRepository;

  beforeEach(async () => {
    const testing = await testDatabase();
    const db = testing.db;
    repository = new VaultRepository(db);
    await db.insert(users).values([{ id: USER_A, email: "a@example.test" }, { id: USER_B, email: "b@example.test" }]);
    await db.insert(vaults).values([
      { id: VAULT_A, userId: USER_A, masterEnvelope: envelope, recoveryEnvelope: { ...envelope, purpose: "recovery", kdf: { name: "hkdf-sha256", salt: "AAAAAAAAAAAAAAAAAAAAAA" } }, cryptoVersion: 1 },
      { id: VAULT_B, userId: USER_B, masterEnvelope: envelope, recoveryEnvelope: { ...envelope, purpose: "recovery", kdf: { name: "hkdf-sha256", salt: "AAAAAAAAAAAAAAAAAAAAAA" } }, cryptoVersion: 1 },
    ]);
    await db.insert(vaultItems).values([
      { id: ITEM_A, vaultId: VAULT_A, ciphertext: CIPHERTEXT, nonce: NONCE, cryptoVersion: 1, revision: 1 },
      { id: ITEM_B, vaultId: VAULT_B, ciphertext: CIPHERTEXT, nonce: NONCE, cryptoVersion: 1, revision: 1 },
    ]);
  });

  it("scopes list and get by authenticated owner", async () => {
    await expect(repository.listItems(USER_A)).resolves.toMatchObject([{ id: ITEM_A }]);
    await expect(repository.getItem(USER_A, ITEM_B)).resolves.toBeNull();
  });

  it("rejects creating an item under another owner's vault", async () => {
    await expect(repository.createItem(USER_A, VAULT_B, { id: "20000000-0000-4000-8000-000000000003", ciphertext: CIPHERTEXT, nonce: NONCE, cryptoVersion: 1, revision: 1 })).resolves.toBeNull();
    await expect(repository.listItems(USER_B)).resolves.toHaveLength(1);
  });

  it("does not update or delete another owner's ciphertext", async () => {
    await expect(repository.updateItem(USER_A, ITEM_B, 1, { ciphertext: `${CIPHERTEXT}A`, nonce: NONCE, cryptoVersion: 1 })).resolves.toEqual({ status: "not_found" });
    await expect(repository.deleteItem(USER_A, ITEM_B, 1)).resolves.toEqual({ status: "not_found" });
    await expect(repository.getItem(USER_B, ITEM_B)).resolves.toMatchObject({ ciphertext: CIPHERTEXT, revision: 1 });
  });

  it("does not export another owner's vault", async () => {
    await expect(repository.exportVault(USER_A, VAULT_B)).resolves.toBeNull();
    const ownExport = await repository.exportVault(USER_A, VAULT_A);
    expect(ownExport).toMatchObject({ vault: { id: VAULT_A }, items: [{ id: ITEM_A }] });
  });

  it("allows exactly one concurrent revision update", async () => {
    const results = await Promise.all([
      repository.updateItem(USER_A, ITEM_A, 1, { ciphertext: `${CIPHERTEXT}A`, nonce: NONCE, cryptoVersion: 1 }),
      repository.updateItem(USER_A, ITEM_A, 1, { ciphertext: `${CIPHERTEXT}B`, nonce: NONCE, cryptoVersion: 1 }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["conflict", "updated"]);
    await expect(repository.getItem(USER_A, ITEM_A)).resolves.toMatchObject({ revision: 2 });
  });
});
