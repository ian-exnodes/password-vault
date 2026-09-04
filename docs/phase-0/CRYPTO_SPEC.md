# Cryptographic Format and Key Lifecycle Specification

Status: Version 1 design baseline; implementation begins in Phase 2.

This document specifies formats and invariants, not a custom cryptographic algorithm. Implementations must use platform primitives or reviewed libraries and test against these rules.

## Algorithms and constants

| Purpose | Version 1 choice |
|---|---|
| Randomness | `crypto.getRandomValues` CSPRNG |
| Master-password KDF | Argon2id v=19, initially m=19,456 KiB, t=2, p=1, 32-byte output |
| Data encryption | AES-256-GCM, 12-byte random nonce, 128-bit authentication tag |
| Recovery secret | 32 random bytes, base64url without padding for transport |
| Text encoding | UTF-8 |
| Binary encoding in JSON | Unpadded base64url |

The Argon2id parameters are a portable floor, not a permanent optimum. Phase 2 must benchmark representative lower-end supported phones and select the strongest versioned profile whose p95 unlock derivation is at most 750 ms, with a hard upper target of 1,500 ms on the slowest supported test device. Existing envelopes retain their parameters and can be upgraded after a successful unlock.

## Key hierarchy

- `VaultKey`: random 32 bytes, one per vault. Encrypts item payloads.
- `MasterKEK`: Argon2id(master password, master salt, stored parameters). Wraps `VaultKey`.
- `RecoveryKEK`: HKDF-SHA-256 over the 32-byte Recovery Key with a random salt and context string `password-vault/recovery-kek/v1`. Wraps the same `VaultKey` in a distinct envelope.
- `QuickUnlockKEK`: optional and device/passkey-specific. It may only exist when WebAuthn PRF support is verified during a real ceremony. Derive with HKDF and context `password-vault/quick-unlock-kek/v1`. It wraps `VaultKey` separately.

Authentication alone must never return a plaintext Vault Key. If PRF is unsupported, passkey login succeeds but vault unlock still requires the master password or Recovery Key.

## Key envelope schema

```json
{
  "format": "password-vault-key-envelope",
  "version": 1,
  "purpose": "master|recovery|quick-unlock",
  "kdf": {
    "name": "argon2id|hkdf-sha256",
    "salt": "base64url",
    "memoryKiB": 19456,
    "iterations": 2,
    "parallelism": 1
  },
  "cipher": {
    "name": "aes-256-gcm",
    "nonce": "base64url",
    "tagBits": 128
  },
  "ciphertext": "base64url"
}
```

Fields irrelevant to a selected KDF must be omitted. Parsers reject unknown format/version/algorithm values and out-of-policy parameter sizes before expensive work.

Key-envelope AAD is deterministic UTF-8:

```text
password-vault:key-envelope:v1:<vault-id>:<purpose>
```

## Vault item schema

The encrypted plaintext is canonical JSON matching:

```json
{
  "schemaVersion": 1,
  "title": "Example",
  "username": "person@example.com",
  "password": "secret",
  "urls": ["https://example.com"],
  "notes": "",
  "tags": ["personal"],
  "favorite": false
}
```

The server-visible envelope is:

```json
{
  "format": "password-vault-item",
  "version": 1,
  "vaultId": "opaque-id",
  "itemId": "opaque-id",
  "revision": 1,
  "cipher": {
    "name": "aes-256-gcm",
    "nonce": "base64url",
    "tagBits": 128
  },
  "ciphertext": "base64url"
}
```

Item AAD is deterministic UTF-8:

```text
password-vault:item:v1:<vault-id>:<item-id>:<revision>
```

Binding the vault, item, and revision prevents cross-item substitution and accidental rollback within normal synchronization. The server enforces that a write's revision is exactly the current revision plus one.

## Lifecycle operations

### Create vault

1. Generate Vault Key, master salt, Recovery Key, and recovery salt.
2. Derive MasterKEK and RecoveryKEK.
3. Create independent master and recovery envelopes with unique nonces.
4. Persist envelopes and show the Recovery Key once.
5. Require the user to confirm recovery storage before adding real items.

### Unlock

1. Fetch versioned envelopes after authentication.
2. Validate format and resource limits.
3. Derive the selected KEK locally and authenticate/decrypt the Vault Key envelope.
4. Import the Vault Key as non-extractable when possible after initial envelope processing.
5. Decrypt individual records on demand; never log failure details that distinguish account state publicly.

### Change master password

1. Re-authenticate and unlock with an existing method.
2. Generate a new master salt and derive a new MasterKEK.
3. Re-wrap the unchanged Vault Key with a new nonce.
4. Atomically replace only the master envelope and invalidate other sessions as policy requires.

Item ciphertext does not need re-encryption because the Vault Key is unchanged.

### Rotate Vault Key

Required after a key compromise or future shared-vault membership removal. Decrypt and re-encrypt every item with a new Vault Key and fresh nonce, then regenerate every authorized key envelope. This must be resumable and transactional at the logical revision level.

## Memory, storage, and error rules

- Never persist the master password, unwrapped Vault Key, Recovery Key, or plaintext items in localStorage, sessionStorage, logs, URLs, crash reports, or service-worker caches.
- JavaScript cannot guarantee memory erasure. Overwrite owned byte arrays when possible, drop references, minimize lifetime, and state the limitation.
- Do not distinguish wrong password from corrupted envelope in user-facing errors.
- Decryption/authentication failure returns no partial plaintext.
- Reject duplicate item IDs, nonce length other than 12 bytes, tags other than 128 bits, unexpected fields where strict parsing applies, and oversized payloads.
- Every migration preserves the original encrypted backup until the migrated vault has been verified.

## Phase 2 mandatory test vectors

- Correct master and recovery round trips.
- Wrong master and Recovery Key rejection.
- One-bit ciphertext, nonce, AAD, tag, revision, vault ID, and item ID tampering rejection.
- Nonce uniqueness across at least 100,000 generated test nonces, plus code-level enforcement of fresh generation.
- Unicode master passwords and payloads with documented normalization policy (password bytes are UTF-8 without hidden normalization).
- KDF parameter bounds and denial-of-service cases.
- Version 1 parsing and unknown-version failure.
- Re-wrap changes the envelope but preserves the Vault Key.
- Migration failure leaves the old envelope usable.
