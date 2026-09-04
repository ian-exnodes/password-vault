import { argon2id } from "hash-wasm";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export const CRYPTO_VERSION = 1 as const;
export const NONCE_BYTES = 12;
export const KEY_BYTES = 32;
export const SALT_BYTES = 16;
export const TAG_BITS = 128 as const;
export const MAX_CIPHERTEXT_BYTES = 1024 * 1024;

export type EnvelopePurpose = "master" | "recovery";

export interface Argon2idParameters {
  name: "argon2id";
  version: 19;
  salt: string;
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

export interface HkdfParameters {
  name: "hkdf-sha256";
  salt: string;
}

export interface KeyEnvelope {
  format: "password-vault-key-envelope";
  version: 1;
  purpose: EnvelopePurpose;
  kdf: Argon2idParameters | HkdfParameters;
  cipher: { name: "aes-256-gcm"; nonce: string; tagBits: 128 };
  ciphertext: string;
}

export interface VaultItemPayload {
  schemaVersion: 1;
  title: string;
  username: string;
  password: string;
  urls: string[];
  notes: string;
  tags: string[];
  favorite: boolean;
}

export interface ItemEnvelope {
  format: "password-vault-item";
  version: 1;
  vaultId: string;
  itemId: string;
  revision: number;
  cipher: { name: "aes-256-gcm"; nonce: string; tagBits: 128 };
  ciphertext: string;
}

export interface MasterKdfProfile {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

export const MASTER_KDF_V1: Readonly<MasterKdfProfile> = Object.freeze({
  memoryKiB: 19_456,
  iterations: 2,
  parallelism: 1,
});

const KDF_LIMITS = Object.freeze({
  memoryKiB: { min: 8 * 1024, max: 256 * 1024 },
  iterations: { min: 1, max: 10 },
  parallelism: { min: 1, max: 4 },
});

export class VaultCryptoError extends Error {
  constructor(message = "Unable to decrypt vault data") {
    super(message);
    this.name = "VaultCryptoError";
  }
}

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle) throw new VaultCryptoError("Web Crypto is unavailable");
  return globalThis.crypto;
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

export function randomBytes(length: number): Uint8Array {
  if (!Number.isSafeInteger(length) || length < 1 || length > 65_536) throw new VaultCryptoError("Invalid random byte length");
  return cryptoApi().getRandomValues(new Uint8Array(length));
}

export function wipe(bytes: Uint8Array): void {
  bytes.fill(0);
}

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function decodeBase64Url(value: unknown, maxBytes = MAX_CIPHERTEXT_BYTES): Uint8Array {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]*$/u.test(value) || value.length % 4 === 1) {
    throw new VaultCryptoError("Invalid encoded data");
  }
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  } catch {
    throw new VaultCryptoError("Invalid encoded data");
  }
  if (binary.length > maxBytes) throw new VaultCryptoError("Encrypted payload is too large");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertIdentity(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 200 || /[:\u0000-\u001f]/u.test(value)) {
    throw new VaultCryptoError("Invalid envelope identity");
  }
}

function assertCipher(value: unknown): asserts value is KeyEnvelope["cipher"] {
  if (!isObject(value) || !exactKeys(value, ["name", "nonce", "tagBits"]) || value.name !== "aes-256-gcm" || value.tagBits !== TAG_BITS) {
    throw new VaultCryptoError("Unsupported cipher parameters");
  }
  if (decodeBase64Url(value.nonce, NONCE_BYTES).length !== NONCE_BYTES) throw new VaultCryptoError("Invalid nonce");
}

function assertKdf(value: unknown, purpose: EnvelopePurpose): asserts value is KeyEnvelope["kdf"] {
  if (!isObject(value)) throw new VaultCryptoError("Invalid KDF parameters");
  if (purpose === "master") {
    if (!exactKeys(value, ["name", "version", "salt", "memoryKiB", "iterations", "parallelism"]) || value.name !== "argon2id" || value.version !== 19) {
      throw new VaultCryptoError("Unsupported KDF parameters");
    }
    const profile = value as unknown as MasterKdfProfile;
    if (!Number.isInteger(profile.memoryKiB) || profile.memoryKiB < KDF_LIMITS.memoryKiB.min || profile.memoryKiB > KDF_LIMITS.memoryKiB.max ||
        !Number.isInteger(profile.iterations) || profile.iterations < KDF_LIMITS.iterations.min || profile.iterations > KDF_LIMITS.iterations.max ||
        !Number.isInteger(profile.parallelism) || profile.parallelism < KDF_LIMITS.parallelism.min || profile.parallelism > KDF_LIMITS.parallelism.max) {
      throw new VaultCryptoError("KDF parameters are outside policy");
    }
  } else if (!exactKeys(value, ["name", "salt"]) || value.name !== "hkdf-sha256") {
    throw new VaultCryptoError("Unsupported KDF parameters");
  }
  if (decodeBase64Url(value.salt, 64).length < SALT_BYTES) throw new VaultCryptoError("Invalid KDF salt");
}

export function parseKeyEnvelope(value: unknown): KeyEnvelope {
  if (!isObject(value) || !exactKeys(value, ["format", "version", "purpose", "kdf", "cipher", "ciphertext"]) ||
      value.format !== "password-vault-key-envelope" || value.version !== CRYPTO_VERSION ||
      (value.purpose !== "master" && value.purpose !== "recovery")) {
    throw new VaultCryptoError("Unsupported key envelope");
  }
  assertKdf(value.kdf, value.purpose);
  assertCipher(value.cipher);
  const ciphertext = decodeBase64Url(value.ciphertext);
  if (ciphertext.length !== KEY_BYTES + TAG_BITS / 8) throw new VaultCryptoError("Invalid wrapped key length");
  return value as unknown as KeyEnvelope;
}

export function parseItemEnvelope(value: unknown): ItemEnvelope {
  if (!isObject(value) || !exactKeys(value, ["format", "version", "vaultId", "itemId", "revision", "cipher", "ciphertext"]) ||
      value.format !== "password-vault-item" || value.version !== CRYPTO_VERSION) throw new VaultCryptoError("Unsupported item envelope");
  assertIdentity(value.vaultId);
  assertIdentity(value.itemId);
  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 1) throw new VaultCryptoError("Invalid revision");
  assertCipher(value.cipher);
  if (decodeBase64Url(value.ciphertext).length <= TAG_BITS / 8) throw new VaultCryptoError("Invalid ciphertext");
  return value as unknown as ItemEnvelope;
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== KEY_BYTES) throw new VaultCryptoError("Invalid key length");
  return cryptoApi().subtle.importKey("raw", ownedBuffer(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function deriveMasterKek(password: string, kdf: Argon2idParameters): Promise<CryptoKey> {
  const salt = decodeBase64Url(kdf.salt, 64);
  const raw = await argon2id({
    password: encoder.encode(password), salt, parallelism: kdf.parallelism, iterations: kdf.iterations,
    memorySize: kdf.memoryKiB, hashLength: KEY_BYTES, outputType: "binary",
  });
  try { return await importAesKey(raw); } finally { wipe(raw); wipe(salt); }
}

async function deriveRecoveryKek(recoveryKey: Uint8Array, kdf: HkdfParameters): Promise<CryptoKey> {
  if (recoveryKey.length !== KEY_BYTES) throw new VaultCryptoError("Invalid recovery material");
  const material = await cryptoApi().subtle.importKey("raw", ownedBuffer(recoveryKey), "HKDF", false, ["deriveKey"]);
  const salt = decodeBase64Url(kdf.salt, 64);
  try {
    return await cryptoApi().subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: ownedBuffer(salt), info: ownedBuffer(encoder.encode("password-vault/recovery-kek/v1")) },
      material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
    );
  } finally { wipe(salt); }
}

function keyAad(vaultId: string, purpose: EnvelopePurpose): Uint8Array {
  assertIdentity(vaultId);
  return encoder.encode(`password-vault:key-envelope:v1:${vaultId}:${purpose}`);
}

function itemAad(vaultId: string, itemId: string, revision: number): Uint8Array {
  assertIdentity(vaultId); assertIdentity(itemId);
  if (!Number.isSafeInteger(revision) || revision < 1) throw new VaultCryptoError("Invalid revision");
  return encoder.encode(`password-vault:item:v1:${vaultId}:${itemId}:${revision}`);
}

async function seal(key: CryptoKey, plaintext: Uint8Array, aad: Uint8Array): Promise<{ nonce: string; ciphertext: string }> {
  const nonce = randomBytes(NONCE_BYTES);
  try {
    const ciphertext = await cryptoApi().subtle.encrypt({ name: "AES-GCM", iv: ownedBuffer(nonce), additionalData: ownedBuffer(aad), tagLength: TAG_BITS }, key, ownedBuffer(plaintext));
    return { nonce: encodeBase64Url(nonce), ciphertext: encodeBase64Url(new Uint8Array(ciphertext)) };
  } finally { wipe(nonce); }
}

async function open(key: CryptoKey, nonceValue: string, ciphertextValue: string, aad: Uint8Array): Promise<Uint8Array> {
  const nonce = decodeBase64Url(nonceValue, NONCE_BYTES);
  const ciphertext = decodeBase64Url(ciphertextValue);
  try {
    return new Uint8Array(await cryptoApi().subtle.decrypt({ name: "AES-GCM", iv: ownedBuffer(nonce), additionalData: ownedBuffer(aad), tagLength: TAG_BITS }, key, ownedBuffer(ciphertext)));
  } catch { throw new VaultCryptoError(); } finally { wipe(nonce); wipe(ciphertext); }
}

export async function generateVaultKey(): Promise<CryptoKey> {
  const raw = randomBytes(KEY_BYTES);
  try { return await importAesKey(raw); } finally { wipe(raw); }
}

export async function createMasterEnvelope(vaultId: string, password: string, vaultKeyBytes?: Uint8Array, profile: MasterKdfProfile = MASTER_KDF_V1): Promise<{ envelope: KeyEnvelope; vaultKey: CryptoKey }> {
  const raw = vaultKeyBytes?.slice() ?? randomBytes(KEY_BYTES);
  const salt = randomBytes(SALT_BYTES);
  const kdf: Argon2idParameters = { name: "argon2id", version: 19, salt: encodeBase64Url(salt), ...profile };
  assertKdf(kdf, "master");
  try {
    const kek = await deriveMasterKek(password, kdf);
    const sealed = await seal(kek, raw, keyAad(vaultId, "master"));
    return { envelope: { format: "password-vault-key-envelope", version: 1, purpose: "master", kdf, cipher: { name: "aes-256-gcm", nonce: sealed.nonce, tagBits: 128 }, ciphertext: sealed.ciphertext }, vaultKey: await importAesKey(raw) };
  } finally { wipe(raw); wipe(salt); }
}

export async function createVaultEnvelopes(vaultId: string, password: string): Promise<{ masterEnvelope: KeyEnvelope; recoveryEnvelope: KeyEnvelope; recoveryKey: Uint8Array; vaultKey: CryptoKey }> {
  const rawVaultKey = randomBytes(KEY_BYTES);
  const recoveryKey = randomBytes(KEY_BYTES);
  try {
    const { envelope: masterEnvelope, vaultKey } = await createMasterEnvelope(vaultId, password, rawVaultKey);
    const recoveryEnvelope = await createRecoveryEnvelope(vaultId, recoveryKey, rawVaultKey);
    return { masterEnvelope, recoveryEnvelope, recoveryKey, vaultKey };
  } finally { wipe(rawVaultKey); }
}

export async function createRecoveryEnvelope(vaultId: string, recoveryKey: Uint8Array, vaultKeyBytes: Uint8Array): Promise<KeyEnvelope> {
  const salt = randomBytes(SALT_BYTES);
  const kdf: HkdfParameters = { name: "hkdf-sha256", salt: encodeBase64Url(salt) };
  try {
    const kek = await deriveRecoveryKek(recoveryKey, kdf);
    const sealed = await seal(kek, vaultKeyBytes, keyAad(vaultId, "recovery"));
    return { format: "password-vault-key-envelope", version: 1, purpose: "recovery", kdf, cipher: { name: "aes-256-gcm", nonce: sealed.nonce, tagBits: 128 }, ciphertext: sealed.ciphertext };
  } finally { wipe(salt); }
}

export async function unlockWithMasterPassword(vaultId: string, password: string, input: unknown): Promise<CryptoKey> {
  const envelope = parseKeyEnvelope(input);
  if (envelope.purpose !== "master" || envelope.kdf.name !== "argon2id") throw new VaultCryptoError();
  try {
    const kek = await deriveMasterKek(password, envelope.kdf);
    const raw = await open(kek, envelope.cipher.nonce, envelope.ciphertext, keyAad(vaultId, "master"));
    try { return await importAesKey(raw); } finally { wipe(raw); }
  } catch { throw new VaultCryptoError(); }
}

export async function unlockWithRecoveryKey(vaultId: string, recoveryKey: Uint8Array, input: unknown): Promise<CryptoKey> {
  const envelope = parseKeyEnvelope(input);
  if (envelope.purpose !== "recovery" || envelope.kdf.name !== "hkdf-sha256") throw new VaultCryptoError();
  try {
    const kek = await deriveRecoveryKek(recoveryKey, envelope.kdf);
    const raw = await open(kek, envelope.cipher.nonce, envelope.ciphertext, keyAad(vaultId, "recovery"));
    try { return await importAesKey(raw); } finally { wipe(raw); }
  } catch { throw new VaultCryptoError(); }
}

export async function encryptItem(vaultKey: CryptoKey, vaultId: string, itemId: string, revision: number, payload: VaultItemPayload): Promise<ItemEnvelope> {
  if (!isObject(payload) || !exactKeys(payload as unknown as Record<string, unknown>, ["schemaVersion", "title", "username", "password", "urls", "notes", "tags", "favorite"]) || payload.schemaVersion !== 1) throw new VaultCryptoError("Invalid item payload");
  const plaintext = encoder.encode(JSON.stringify(payload));
  try {
    const sealed = await seal(vaultKey, plaintext, itemAad(vaultId, itemId, revision));
    return { format: "password-vault-item", version: 1, vaultId, itemId, revision, cipher: { name: "aes-256-gcm", nonce: sealed.nonce, tagBits: 128 }, ciphertext: sealed.ciphertext };
  } finally { wipe(plaintext); }
}

export async function decryptItem(vaultKey: CryptoKey, input: unknown): Promise<VaultItemPayload> {
  const envelope = parseItemEnvelope(input);
  const plaintext = await open(vaultKey, envelope.cipher.nonce, envelope.ciphertext, itemAad(envelope.vaultId, envelope.itemId, envelope.revision));
  try {
    const payload: unknown = JSON.parse(decoder.decode(plaintext));
    if (!isObject(payload) || !exactKeys(payload, ["schemaVersion", "title", "username", "password", "urls", "notes", "tags", "favorite"]) || payload.schemaVersion !== 1 ||
        typeof payload.title !== "string" || typeof payload.username !== "string" || typeof payload.password !== "string" || typeof payload.notes !== "string" || typeof payload.favorite !== "boolean" ||
        !Array.isArray(payload.urls) || !payload.urls.every((value) => typeof value === "string") || !Array.isArray(payload.tags) || !payload.tags.every((value) => typeof value === "string")) throw new VaultCryptoError("Invalid decrypted item");
    return payload as unknown as VaultItemPayload;
  } catch (error) { if (error instanceof VaultCryptoError) throw error; throw new VaultCryptoError("Invalid decrypted item"); }
  finally { wipe(plaintext); }
}

export async function rewrapMasterEnvelope(vaultId: string, oldPassword: string, newPassword: string, input: unknown): Promise<KeyEnvelope> {
  const oldEnvelope = parseKeyEnvelope(input);
  const oldKek = oldEnvelope.purpose === "master" && oldEnvelope.kdf.name === "argon2id" ? await deriveMasterKek(oldPassword, oldEnvelope.kdf) : null;
  if (!oldKek) throw new VaultCryptoError();
  const raw = await open(oldKek, oldEnvelope.cipher.nonce, oldEnvelope.ciphertext, keyAad(vaultId, "master"));
  try { return (await createMasterEnvelope(vaultId, newPassword, raw)).envelope; }
  finally { wipe(raw); }
}
