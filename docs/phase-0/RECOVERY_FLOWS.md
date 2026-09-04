# Authentication, Recovery, and Device Flows

Status: Phase 0 baseline

## Principles

- Service authentication and vault decryption are separate gates.
- The server cannot reset the master password in a way that decrypts the vault.
- Recovery uses user-held, high-entropy material, not email security questions.
- Destructive recovery consequences are explicit and tested.

## First-time setup

1. The invite-gated user authenticates to the service.
2. The client asks for a master password and estimates strength locally; it does not transmit the value.
3. The client creates the Vault Key and recovery material following `CRYPTO_SPEC.md`.
4. The user downloads or copies a recovery document containing the Recovery Key, account identifier, format version, date, and warning.
5. The UI asks the user to re-enter a randomly selected segment of the Recovery Key.
6. Only after successful confirmation does setup complete.

The recovery document never includes the master password or plaintext vault data.

## Normal unlock

1. Passkey authentication creates a time-bounded server session.
2. If a compatible quick-unlock envelope exists and a WebAuthn PRF result is available, the client unwraps the Vault Key after user verification.
3. Otherwise the client prompts for the master password and derives MasterKEK locally.
4. Five consecutive local failures trigger an increasing client delay; server endpoints are separately rate-limited without receiving the password.

## New device

1. Authenticate with an existing passkey, cross-device passkey flow, or future account bootstrap method.
2. Unlock with master password or Recovery Key.
3. Optionally register a new passkey after re-authentication.
4. Offer quick unlock only if PRF support succeeds in the actual registration/authentication ceremony.
5. Record the device/session so it can be named and revoked.

No existing trusted device is required if the user still has both a valid authentication method and either vault-unlock secret.

## Forgotten master password

With Recovery Key:

1. Authenticate to the account.
2. Enter/import the Recovery Key locally.
3. Decrypt the recovery envelope and obtain the Vault Key.
4. Choose a new master password, generate a fresh master salt, and replace the master envelope atomically.
5. Rotate sessions and remove quick-unlock envelopes unless the user re-enrolls them.
6. Generate a new Recovery Key and invalidate the old recovery envelope.

Without Recovery Key:

- Existing plaintext cannot be recovered by the service.
- An already-unlocked device may be used to create new recovery material after strong local confirmation and server re-authentication.
- If no device is unlocked, the only supported action is cryptographic erasure/reset: delete the old encrypted vault after a cooling-off period and create an empty vault.

## Lost device

1. From another device, authenticate and open Sessions.
2. Revoke the lost device's server session and registered passkey credential if appropriate.
3. Remove its quick-unlock envelope.
4. If the device may have been unlocked or compromised, rotate the Vault Key and re-encrypt items.
5. Review security-event timestamps that reveal no vault contents.

Remote revocation cannot erase plaintext already captured by a compromised or unlocked device.

## Change master password

Require a fresh passkey/server re-authentication plus current vault unlock. Re-wrap the existing Vault Key under a freshly derived MasterKEK. Do not re-encrypt every item. Invalidate all server sessions except the current one by default and remove quick-unlock envelopes pending re-enrollment.

## Export and import

- Export requires recent re-authentication and vault unlock.
- Default export is a versioned encrypted package; plaintext export is deferred and, if ever added, requires an explicit danger flow.
- Import validates file size, record count, schema, crypto version, duplicates, and authentication tags before committing changes.
- Import is transactional and produces an encrypted rollback snapshot.

## Account deletion

Require recent authentication and a typed confirmation. Mark the account for deletion with a defined cooling-off period, revoke sessions immediately, and delete encrypted blobs/backups according to retention policy. The service must not claim cryptographic erasure until all documented replicas age out.

## Required Phase 4 E2E scenarios

- First setup and recovery confirmation.
- Unlock with master password.
- Passkey authentication with master-password fallback for vault unlock.
- PRF quick unlock supported and unsupported branches.
- New-device enrollment.
- Forgotten master password with Recovery Key.
- Forgotten master password with neither recovery nor unlocked device.
- Lost-device revocation.
- Master-password change and old-password rejection.
- Recovery rotation and old-Recovery-Key rejection.
