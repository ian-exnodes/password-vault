// @vitest-environment node

import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { createVaultEnvelopes, decryptItem, encryptItem, unlockWithMasterPassword, type KeyEnvelope } from "@/lib/crypto/core";
import { users, vaultItems, vaults } from "@/lib/server/db/schema";
import { testDatabase } from "@/tests/helpers/postgres";

const VAULT_ID = "10000000-0000-4000-8000-000000000001";
const ITEM_ID = "20000000-0000-4000-8000-000000000001";

describe("encrypted database backup and restore", () => {
  it("restores ciphertext and decryptability into a clean PostgreSQL-compatible database", async () => {
    const { client: source, db } = await testDatabase();
    const created = await createVaultEnvelopes(VAULT_ID, "backup-test-master-password");
    const encrypted = await encryptItem(created.vaultKey, VAULT_ID, ITEM_ID, 1, {
      schemaVersion: 1, title: "Secret title that must not reach PostgreSQL", username: "private@example.test",
      password: "ultra-secret-password", urls: ["https://private.example.test"], notes: "private notes", tags: ["private"], favorite: true,
    });
    await db.insert(users).values({ id: "00000000-0000-4000-8000-000000000001", email: "backup@example.test" });
    await db.insert(vaults).values({ id: VAULT_ID, userId: "00000000-0000-4000-8000-000000000001", masterEnvelope: created.masterEnvelope, recoveryEnvelope: created.recoveryEnvelope, cryptoVersion: 1 });
    await db.insert(vaultItems).values([
      { id: encrypted.itemId, vaultId: encrypted.vaultId, ciphertext: encrypted.ciphertext, nonce: encrypted.cipher.nonce, cryptoVersion: encrypted.version, revision: encrypted.revision },
      { id: "20000000-0000-4000-8000-000000000002", vaultId: VAULT_ID, ciphertext: "BBBBBBBBBBBBBBBBBBBBBBB", nonce: "BBBBBBBBBBBBBBBB", cryptoVersion: 1, revision: 7 },
    ]);
    const before = await source.query<{ count: number; revisions: number; digest: string }>("select count(*)::int as count, sum(revision)::int as revisions, md5(string_agg(ciphertext || nonce || revision, '' order by id)) as digest from vault_items");

    const backup = await source.dumpDataDir("gzip");
    expect(backup.size).toBeGreaterThan(0);
    const restored = new PGlite({ loadDataDir: backup });
    await restored.waitReady;
    const after = await restored.query<{ count: number; revisions: number; digest: string }>("select count(*)::int as count, sum(revision)::int as revisions, md5(string_agg(ciphertext || nonce || revision, '' order by id)) as digest from vault_items");
    expect(after.rows).toEqual(before.rows);

    const columns = await restored.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'vault_items' order by ordinal_position");
    expect(columns.rows.map((row) => row.column_name)).toEqual(["id", "vault_id", "ciphertext", "nonce", "crypto_version", "revision", "created_at", "updated_at", "deleted_at"]);
    expect(JSON.stringify(columns.rows)).not.toMatch(/title|username|password|notes|tags|favorite/);

    const [restoredVault] = (await restored.query<{ master_envelope: KeyEnvelope }>("select master_envelope from vaults")).rows;
    const [restoredItem] = (await restored.query<{ id: string; vault_id: string; ciphertext: string; nonce: string; crypto_version: number; revision: number }>("select id, vault_id, ciphertext, nonce, crypto_version, revision from vault_items where id = $1", [ITEM_ID])).rows;
    const restoredKey = await unlockWithMasterPassword(restoredItem.vault_id, "backup-test-master-password", restoredVault.master_envelope);
    await expect(decryptItem(restoredKey, {
      format: "password-vault-item", version: restoredItem.crypto_version, vaultId: restoredItem.vault_id, itemId: restoredItem.id, revision: restoredItem.revision,
      cipher: { name: "aes-256-gcm", nonce: restoredItem.nonce, tagBits: 128 }, ciphertext: restoredItem.ciphertext,
    })).resolves.toMatchObject({ password: "ultra-secret-password" });
    created.recoveryKey.fill(0);
    await restored.close();
    await source.close();
  });
});
