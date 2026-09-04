import { webcrypto } from "node:crypto";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { argon2id } from "hash-wasm";

const crypto = webcrypto;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const KDF = Object.freeze({
  algorithm: "argon2id",
  version: 19,
  memoryKiB: 19_456,
  iterations: 2,
  parallelism: 1,
  outputBytes: 32,
});

function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function deriveKek(masterPassword, salt) {
  const raw = await argon2id({
    password: masterPassword,
    salt,
    parallelism: KDF.parallelism,
    iterations: KDF.iterations,
    memorySize: KDF.memoryKiB,
    hashLength: KDF.outputBytes,
    outputType: "binary",
  });

  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(key, plaintext, aad) {
  const nonce = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: encoder.encode(aad), tagLength: 128 },
    key,
    plaintext,
  );
  return { nonce, ciphertext: new Uint8Array(ciphertext) };
}

async function decrypt(key, envelope, aad) {
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: envelope.nonce,
        additionalData: encoder.encode(aad),
        tagLength: 128,
      },
      key,
      envelope.ciphertext,
    ),
  );
}

const salt = randomBytes(16);
const started = performance.now();
const kek = await deriveKek("correct horse battery staple", salt);
const kdfDurationMs = performance.now() - started;

const rawVaultKey = randomBytes(32);
const vaultKey = await crypto.subtle.importKey("raw", rawVaultKey, "AES-GCM", false, ["encrypt", "decrypt"]);
const keyEnvelopeAad = "password-vault:key-envelope:v1:vault-123:master";
const wrappedVaultKey = await encrypt(kek, rawVaultKey, keyEnvelopeAad);
const unwrappedRawVaultKey = await decrypt(kek, wrappedVaultKey, keyEnvelopeAad);
assert.deepEqual(unwrappedRawVaultKey, rawVaultKey);

const item = encoder.encode(JSON.stringify({ title: "Example", username: "person@example.com", password: "secret" }));
const itemAad = "password-vault:item:v1:vault-123:item-123:1";
const encryptedItem = await encrypt(vaultKey, item, itemAad);
assert.equal(decoder.decode(await decrypt(vaultKey, encryptedItem, itemAad)), decoder.decode(item));

const tampered = { ...encryptedItem, ciphertext: encryptedItem.ciphertext.slice() };
tampered.ciphertext[0] ^= 1;
await assert.rejects(() => decrypt(vaultKey, tampered, itemAad));

const wrongKek = await deriveKek("wrong password", salt);
await assert.rejects(() => decrypt(wrongKek, wrappedVaultKey, keyEnvelopeAad));

console.log(JSON.stringify({
  result: "PASS",
  kdf: KDF,
  kdfDurationMs: Math.round(kdfDurationMs),
  checks: ["vault-key-wrap-round-trip", "item-round-trip", "tamper-rejected", "wrong-password-rejected"],
}, null, 2));
