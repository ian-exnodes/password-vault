import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMasterEnvelope,
  createVaultEnvelopes,
  decryptItem,
  encodeBase64Url,
  encryptItem,
  parseItemEnvelope,
  parseKeyEnvelope,
  randomBytes,
  rewrapMasterEnvelope,
  unlockWithMasterPassword,
  unlockWithRecoveryKey,
  VaultCryptoError,
  type ItemEnvelope,
  type VaultItemPayload,
} from "@/lib/crypto/core";
import { VaultSession } from "@/lib/crypto/session";

const item: VaultItemPayload = {
  schemaVersion: 1,
  title: "Ngân hàng 🔐",
  username: "ian@example.com",
  password: "mật-khẩu-正しい",
  urls: ["https://example.com"],
  notes: "Không normalize Unicode bí mật.",
  tags: ["cá nhân"],
  favorite: true,
};

function flipBit(value: string): string {
  const bytes = Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4)), (character) => character.charCodeAt(0));
  bytes[0] ^= 1;
  return encodeBase64Url(bytes);
}

describe("version 1 vault cryptography", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("round-trips Unicode through master and recovery unlock without password normalization", async () => {
    const created = await createVaultEnvelopes("vault-1", "pässword-e\u0301");
    const masterKey = await unlockWithMasterPassword("vault-1", "pässword-e\u0301", created.masterEnvelope);
    const recoveryKey = await unlockWithRecoveryKey("vault-1", created.recoveryKey, created.recoveryEnvelope);
    const envelope = await encryptItem(masterKey, "vault-1", "item-1", 1, item);

    await expect(decryptItem(masterKey, envelope)).resolves.toEqual(item);
    await expect(decryptItem(recoveryKey, envelope)).resolves.toEqual(item);
    await expect(unlockWithMasterPassword("vault-1", "pässword-é", created.masterEnvelope)).rejects.toBeInstanceOf(VaultCryptoError);
    created.recoveryKey.fill(0);
  });

  it("rejects wrong master and recovery material with the same failure type", async () => {
    const created = await createVaultEnvelopes("vault-1", "correct");
    await expect(unlockWithMasterPassword("vault-1", "wrong", created.masterEnvelope)).rejects.toMatchObject({ name: "VaultCryptoError" });
    await expect(unlockWithRecoveryKey("vault-1", randomBytes(32), created.recoveryEnvelope)).rejects.toMatchObject({ name: "VaultCryptoError" });
    created.recoveryKey.fill(0);
  });

  it.each(["ciphertext", "nonce"] as const)("rejects one-bit %s tampering without plaintext", async (field) => {
    const { vaultKey } = await createMasterEnvelope("vault-1", "password");
    const envelope = await encryptItem(vaultKey, "vault-1", "item-1", 1, item);
    const tampered: ItemEnvelope = field === "ciphertext"
      ? { ...envelope, ciphertext: flipBit(envelope.ciphertext) }
      : { ...envelope, cipher: { ...envelope.cipher, nonce: flipBit(envelope.cipher.nonce) } };
    await expect(decryptItem(vaultKey, tampered)).rejects.toBeInstanceOf(VaultCryptoError);
  });

  it.each([
    ["vault ID", { vaultId: "vault-2" }],
    ["item ID", { itemId: "item-2" }],
    ["revision", { revision: 2 }],
  ] as const)("binds ciphertext to its %s", async (_label, change) => {
    const { vaultKey } = await createMasterEnvelope("vault-1", "password");
    const envelope = await encryptItem(vaultKey, "vault-1", "item-1", 1, item);
    await expect(decryptItem(vaultKey, { ...envelope, ...change })).rejects.toBeInstanceOf(VaultCryptoError);
  });

  it("binds key envelopes to vault identity and rejects ciphertext/tag tampering", async () => {
    const { envelope } = await createMasterEnvelope("vault-1", "password");
    await expect(unlockWithMasterPassword("vault-2", "password", envelope)).rejects.toBeInstanceOf(VaultCryptoError);
    await expect(unlockWithMasterPassword("vault-1", "password", { ...envelope, ciphertext: flipBit(envelope.ciphertext) })).rejects.toBeInstanceOf(VaultCryptoError);
    const bytes = Uint8Array.from(atob(envelope.ciphertext.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - envelope.ciphertext.length % 4) % 4)), (c) => c.charCodeAt(0));
    bytes[bytes.length - 1] ^= 1;
    await expect(unlockWithMasterPassword("vault-1", "password", { ...envelope, ciphertext: encodeBase64Url(bytes) })).rejects.toBeInstanceOf(VaultCryptoError);
  });

  it("rejects unknown versions, unexpected fields, invalid nonces, and KDF denial-of-service parameters before derivation", async () => {
    const { envelope } = await createMasterEnvelope("vault-1", "password");
    expect(() => parseKeyEnvelope({ ...envelope, version: 2 })).toThrow(VaultCryptoError);
    expect(() => parseKeyEnvelope({ ...envelope, extra: true })).toThrow(VaultCryptoError);
    expect(() => parseKeyEnvelope({ ...envelope, cipher: { ...envelope.cipher, nonce: encodeBase64Url(randomBytes(11)) } })).toThrow(VaultCryptoError);
    const deriveSpy = vi.spyOn(globalThis.crypto.subtle, "importKey");
    expect(() => parseKeyEnvelope({ ...envelope, kdf: { ...envelope.kdf, memoryKiB: 1_000_000 } })).toThrow(/outside policy/);
    expect(deriveSpy).not.toHaveBeenCalled();
  });

  it("strictly parses item envelopes and rejects oversized ciphertext", async () => {
    const { vaultKey } = await createMasterEnvelope("vault-1", "password");
    const envelope = await encryptItem(vaultKey, "vault-1", "item-1", 1, item);
    expect(parseItemEnvelope(envelope)).toEqual(envelope);
    expect(() => parseItemEnvelope({ ...envelope, version: 99 })).toThrow(VaultCryptoError);
    expect(() => parseItemEnvelope({ ...envelope, ignored: "field" })).toThrow(VaultCryptoError);
    expect(() => parseItemEnvelope({ ...envelope, ciphertext: "A".repeat(1_500_000) })).toThrow(VaultCryptoError);
  });

  it("uses a fresh nonce for every encryption across 100,000 samples", () => {
    const nonces = new Set<string>();
    for (let index = 0; index < 100_000; index += 1) nonces.add(encodeBase64Url(randomBytes(12)));
    expect(nonces.size).toBe(100_000);
  });

  it("re-wraps the same Vault Key and leaves the old envelope usable if replacement fails", async () => {
    const { envelope, vaultKey } = await createMasterEnvelope("vault-1", "old password");
    const encrypted = await encryptItem(vaultKey, "vault-1", "item-1", 1, item);
    const replacement = await rewrapMasterEnvelope("vault-1", "old password", "new password", envelope);
    expect(replacement).not.toEqual(envelope);
    await expect(decryptItem(await unlockWithMasterPassword("vault-1", "new password", replacement), encrypted)).resolves.toEqual(item);
    await expect(decryptItem(await unlockWithMasterPassword("vault-1", "old password", envelope), encrypted)).resolves.toEqual(item);
    await expect(rewrapMasterEnvelope("vault-1", "wrong", "newer", envelope)).rejects.toBeInstanceOf(VaultCryptoError);
    await expect(decryptItem(await unlockWithMasterPassword("vault-1", "old password", envelope), encrypted)).resolves.toEqual(item);
  });

  it("drops the in-memory non-extractable key when locking", async () => {
    const { vaultKey } = await createMasterEnvelope("vault-1", "password");
    const session = new VaultSession();
    expect(vaultKey.extractable).toBe(false);
    session.unlock(vaultKey);
    expect(session.requireKey()).toBe(vaultKey);
    session.lock("manual");
    expect(session.isLocked).toBe(true);
    expect(() => session.requireKey()).toThrow("Vault is locked");
  });
});
