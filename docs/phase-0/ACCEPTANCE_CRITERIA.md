# Measurable Acceptance Criteria

Status: Phase 0 baseline

These criteria turn roadmap exit statements into verifiable gates. A phase may add stricter criteria but may not silently weaken these values.

## Phase 1 — Mobile UI prototype

- All specified screens render without horizontal overflow at 320, 360, 390, 768, and 1280 CSS-pixel widths.
- Interactive controls have an accessible name and primary touch targets are at least 44 × 44 CSS pixels.
- Keyboard-only users can complete every fixture-data flow with visible focus and no trap.
- Automated axe scans report zero critical or serious violations on primary screens; manual VoiceOver and TalkBack smoke tests are recorded.
- The five-task usability script has 100% completion by the project owner, with no accidental destructive action.
- Search feedback for 1,000 fixture items is under 100 ms p95 on the reference development device.

## Phase 2 — Client cryptography

- All mandatory vectors in `CRYPTO_SPEC.md` pass deterministically in unit tests, except the probabilistic 100,000-nonce uniqueness test which must pass in CI runs.
- One-bit tampering of ciphertext, nonce, AAD identity fields, tag, and revision always rejects without plaintext output.
- Argon2id p95 derivation is at most 750 ms on representative supported phones and at most 1,500 ms on the slowest supported device; selected parameters are recorded per crypto version.
- No master password, Recovery Key, Vault Key, or plaintext item appears in persisted browser storage, API request bodies, server logs, or service-worker caches during an instrumented E2E run.
- Unknown crypto versions and parameters outside documented bounds fail before decrypt/parse.

## Phase 3 — Backend and synchronization

- Two-user negative tests cover list, get, create-under-foreign-vault, update, delete, export, session, and device operations; every cross-user attempt returns a non-disclosing denial.
- Database and backup inspection finds only encrypted item payloads and wrapped keys, never vault plaintext or usable decryption keys.
- Concurrent writes produce one success and one explicit revision conflict; no last-write-wins data loss.
- Session cookie has `HttpOnly`, `Secure`, `SameSite=Strict`, host-only scope, and prescribed expiry in production tests.
- State-changing endpoints reject missing/invalid CSRF proof or invalid Origin as designed.
- Backup restore into a clean environment reproduces ciphertext counts and revisions exactly.

## Phase 4 — Passkeys and recovery

- Registration and authentication verify challenge, expected origin, RP ID, and required user verification; challenges are single-use and expire within five minutes.
- Every scenario in `RECOVERY_FLOWS.md` passes E2E tests on supported browser paths.
- Unsupported WebAuthn PRF never offers quick unlock and cleanly falls back to master/recovery unlock.
- Changing the master password rejects the old password but leaves every item decryptable with the unchanged Vault Key.
- Rotating recovery invalidates the old Recovery Key.
- Revoking a device prevents its next authenticated API request and removes its quick-unlock envelope server-side.

## Phase 5 — PWA and hardening

- Installability passes Chrome tooling checks and manual iOS Add to Home Screen verification.
- Service-worker cache inspection contains only allow-listed public shell assets and no authenticated response, ciphertext API response, export, or plaintext.
- Vault locks after 5 minutes inactivity and within 30 seconds of sustained backgrounding in the real-device test matrix.
- Clipboard clear is attempted at the configured 30-second default and the OS-history limitation is visible in Settings.
- Production responses pass the checked-in header assertions for CSP, HSTS, no-sniff, frame denial, referrer policy, permissions policy, and `no-store` where sensitive.
- Production dependency audit has no unresolved critical/high finding; exceptions require documented owner, impact, mitigation, and expiry.

## Phase 6 — Release validation

- All unit, integration, E2E, mobile, accessibility, authorization, crypto, migration, and backup-restore suites pass from a clean checkout.
- A database-compromise exercise reveals no fixture plaintext or usable key.
- Tampered ciphertext, lost-device revocation, recovery, and clean-device restore drills pass and are recorded.
- Staging operates for at least seven days with fixture credentials and no unresolved severity-high defect.
- The go/no-go record names residual risks, supported browsers/devices, rollback steps, backup status, and the approver.

## Future multi-user gate

Before enabling a second real user or public invitations:

- Phase 3 cross-user tests remain green in production-like deployment.
- Every repository query is reviewed for explicit authenticated ownership or intentional administrator scope.
- Rate limits, account lifecycle, deletion, privacy notice, and abuse response are documented.
- No administrative tool can decrypt vault contents.

Before item/family sharing, create a separate threat model and crypto spec for per-member key wrapping, membership roles, revocation, and Vault Key rotation.
