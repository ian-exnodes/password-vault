# Personal Password Vault — Product Plan

Last updated: 2026-09-04

## Product direction

Build a convenient, secure, mobile-first password vault whose common flow—unlock, find an account, and copy a credential—takes only a few taps.

The MVP will have one active user. The system must nevertheless model ownership explicitly so it can later support friends and family without a destructive schema rewrite or insecure authorization retrofit.

Project/repository name: `password-vault`.

## Product principles

1. Zero knowledge: the server stores encrypted vault payloads and cannot read their contents.
2. Mobile first: design and test from a 360 px viewport upward.
3. Secure defaults: hidden passwords, automatic locking, clipboard expiry, restricted sessions, and minimal metadata.
4. Recovery is explicit: losing both the master password and recovery key means losing access to the vault.
5. Multi-user-ready, not prematurely multi-user: establish ownership boundaries now; add invitations and sharing later.

## MVP scope

### Included

- One enabled user account, with registration disabled or invite-gated.
- Master-password vault setup and unlock.
- Passkey authentication and trusted-device quick unlock.
- Create, read, update, and delete login items.
- Fields: name, username/email, password, URL, notes, tags, and favorite state.
- Client-side search and filtering.
- Password generator.
- Encrypted import/export.
- Automatic locking and clipboard timeout.
- Device/session list with remote revocation.
- Installable PWA, dark mode, and accessible mobile UI.

### Deferred

- Public registration, invitations, and account administration.
- Shared/family vaults and item sharing.
- Browser extension and autofill.
- File attachments and version history.
- Breach monitoring and password-health reporting.
- TOTP storage.
- Native mobile applications.
- Offline vault access beyond a cached application shell.

## Core mobile experience

Bottom navigation contains Vault, Favorites, Generator, and Settings. Search remains prominent on the Vault screen. A floating action button adds an item. Passwords remain concealed by default; copy and reveal are separate actions. The vault locks after inactivity, prolonged backgrounding, logout, or session revocation.

Target interaction:

1. Open the installed PWA.
2. Unlock with device verification/passkey or the master password.
3. Search for an account.
4. Copy the username or password.
5. Clear the clipboard after a configurable short delay.

## Security architecture

### Key hierarchy

1. Generate a random 256-bit Vault Key on the client.
2. Derive a Key Encryption Key from the master password using Argon2id with a unique salt and versioned parameters.
3. Wrap the Vault Key with the Key Encryption Key.
4. Encrypt every item independently with an authenticated encryption algorithm such as AES-256-GCM and a unique nonce.
5. Store only ciphertext, nonce, encrypted Vault Key, crypto version, and essential synchronization metadata on the server.

Item title, username, URL, password, notes, tags, and favorite state belong inside the encrypted payload. Search occurs client-side after unlocking.

Passkeys authenticate a user to the service; they do not automatically replace the vault key hierarchy. A new device requires the master password or recovery material before it can decrypt the vault.

### Application safeguards

- HTTPS and HSTS in production.
- Session IDs in `HttpOnly`, `Secure`, `SameSite=Strict` cookies; never browser local storage.
- Strict Content Security Policy and no third-party scripts on authenticated vault pages.
- `Cache-Control: no-store` for sensitive responses.
- CSRF protection, login rate limiting, session rotation, idle timeout, and absolute timeout.
- No plaintext secrets, encryption keys, session tokens, or encrypted payloads in logs.
- Re-authentication before export, master-password changes, recovery changes, or adding a trusted device.
- Encrypted database backups with verified restore procedures.
- Versioned encrypted payloads and migration tests.

## Multi-user evolution

### Foundations required in MVP

- Every vault belongs to a `user_id`; never infer a global current vault.
- Every API query scopes by authenticated owner on the server.
- Authorization tests prove that one user cannot read, mutate, export, or delete another user's ciphertext.
- Authentication, user identity, vault ownership, and encryption keys remain separate concepts.
- Do not use singleton IDs or environment-variable user IDs in domain logic.

### Later phases

1. Add invite-only account creation and per-user vaults.
2. Add account lifecycle, quotas, abuse controls, and administrative observability without logging secrets.
3. Design shared vaults using a separate shared Vault Key wrapped for each member.
4. Add membership roles, key rotation on member removal, audit events, and sharing-specific authorization tests.

Sharing must not be implemented by sharing a user's master password or primary Vault Key.

## Proposed technical stack

- Next.js and TypeScript for the PWA and backend-for-frontend.
- Tailwind CSS plus accessible UI primitives.
- Web Crypto API for authenticated encryption.
- A reviewed Argon2id WebAssembly implementation for client-side key derivation.
- PostgreSQL with Drizzle ORM or Prisma.
- A mature WebAuthn/passkey library.
- Zod for boundary validation.
- Vitest for unit/integration tests and Playwright for mobile E2E tests.
- Docker-based production deployment behind a TLS reverse proxy.

Final library choices require a short proof of concept and security review during Phase 0.

## Preliminary data model

### users

- `id`
- `email`
- `status`
- `created_at`

### auth_credentials

- `id`
- `user_id`
- `credential_id`
- `public_key`
- `sign_count`
- `transports`

### vaults

- `id`
- `user_id`
- `encrypted_vault_key`
- `kdf_salt`
- `kdf_parameters`
- `crypto_version`
- `created_at`
- `updated_at`

### vault_items

- `id`
- `vault_id`
- `ciphertext`
- `nonce`
- `crypto_version`
- `revision`
- `created_at`
- `updated_at`

### sessions

- `id`
- `user_id`
- `device_name`
- `expires_at`
- `revoked_at`

## Delivery roadmap

When a phase satisfies its exit criteria, update this document and `docs/PROGRESS.md`, commit the completed phase, and push that commit to the configured GitHub repository. Until a remote repository is provided, phase-completion pushes remain pending and must be recorded as such.

### Phase 0 — Product design and threat model

Status: Completed (2026-09-04)

- [x] Define assets, trust boundaries, attackers, and abuse cases.
- [x] Specify the versioned encrypted-payload format and key lifecycle.
- [x] Define recovery, master-password change, and new-device flows.
- [x] Confirm the technical stack through small proofs of concept.
- [x] Produce mobile wireframes and accessibility requirements.
- [x] Define measurable acceptance criteria for every later phase.

Exit criteria: threat model, crypto specification, recovery specification, architecture decision record, and mobile wireframes have been reviewed.

Phase record: see `docs/PROGRESS.md` and the reviewed artifacts under `docs/phase-0/`.

### Phase 1 — Mobile UI prototype

Status: In progress

- [x] Build the responsive application shell and bottom navigation.
- [x] Build mocked Vault list, detail, add/edit, Favorites, Generator, and Settings screens.
- [ ] Verify keyboard, screen-reader, touch-target, light/dark, and 360 px behavior.

Exit criteria: all primary flows work with fixture data on current Safari iOS and Chrome Android viewports.

### Phase 2 — Client cryptography core

Status: Not started

- [ ] Implement Vault Key generation and wrapping.
- [ ] Implement Argon2id derivation with stored, versioned parameters.
- [ ] Implement per-item authenticated encryption with unique nonces.
- [ ] Implement memory/state cleanup and automatic locking.
- [ ] Test round trips, wrong passwords, tampering, nonce uniqueness, and crypto-version migration.

Exit criteria: reviewed crypto tests pass and the UI contains no real credentials before this phase completes.

### Phase 3 — Backend and synchronization

Status: Not started

- [ ] Add database migrations and explicit user/vault ownership.
- [ ] Build APIs that accept and return encrypted blobs only.
- [ ] Add revision-based conflict handling.
- [ ] Add secure session cookies, CSRF protection, rate limits, and device revocation.
- [ ] Add cross-user authorization tests despite only one enabled MVP user.
- [ ] Verify database backup and restore.

Exit criteria: a stolen database cannot reveal vault contents, and authorization tests reject all cross-user access.

### Phase 4 — Passkeys and recovery

Status: Not started

- [ ] Register and authenticate with passkeys.
- [ ] Implement trusted-device enrollment and removal.
- [ ] Implement recovery key generation and recovery flow.
- [ ] Implement master-password change by re-wrapping rather than re-encrypting every item.
- [ ] Require re-authentication for sensitive operations.

Exit criteria: new-device, lost-device, master-password-change, and recovery scenarios pass E2E tests.

### Phase 5 — PWA and security hardening

Status: Not started

- [ ] Make the application installable without caching plaintext vault data.
- [ ] Implement background/inactivity locking and clipboard expiry.
- [ ] Configure CSP, HSTS, security headers, and no-store responses.
- [ ] Audit logging and dependencies for accidental secret exposure.
- [ ] Test real-device behavior on iOS and Android.

Exit criteria: the security checklist and mobile-device test matrix pass.

### Phase 6 — Release validation

Status: Not started

- [ ] Complete unit, integration, and E2E suites.
- [ ] Run dependency and application security checks.
- [ ] Exercise database compromise, lost-device, session revocation, and tampered-ciphertext scenarios.
- [ ] Restore a production-like encrypted backup onto a clean environment.
- [ ] Deploy staging and operate exclusively with test credentials during a soak period.

Exit criteria: all MVP acceptance criteria pass, known risks are documented, and production rollout has an explicit go/no-go decision.

## MVP acceptance criteria

- The server and database never receive vault plaintext or usable decryption keys.
- A database dump is unreadable without the master password or recovery material.
- Wrong passwords and modified ciphertext fail closed.
- Authentication/session credentials are absent from browser local storage.
- The vault locks reliably on supported mobile browsers.
- An encrypted backup restores successfully on a clean device.
- A lost device can have its server session revoked.
- Search, add, edit, reveal, and copy flows are usable at a 360 px viewport.
- Crypto versioning, recovery, and cross-user isolation have automated tests.

## Decision log

### 2026-09-04 — Single-user MVP with multi-user boundaries

Operate the first release for one person, while retaining explicit `user_id` ownership, owner-scoped APIs, and cross-user isolation tests. Defer registration, invitations, and sharing until the base vault has passed security validation.

### 2026-09-04 — Zero-knowledge vault

Encrypt and decrypt vault content on the client. The service stores encrypted payloads and synchronization metadata only.

### 2026-09-04 — Persistent progress records

Use this document for phase/checklist status and `docs/PROGRESS.md` as the append-only implementation history. Update both whenever a task or phase is completed.

### 2026-09-04 — Phase-based GitHub delivery

Push to GitHub after an entire phase meets its exit criteria and its plan/progress documentation has been updated. Do not treat individual task completion as authorization to push, and do not push before the repository remote and branch are supplied.

### 2026-09-04 — Phase 0 architecture baseline

Use a Next.js/TypeScript modular monolith, PostgreSQL with Drizzle, Web Crypto AES-GCM, an Argon2id WASM candidate, SimpleWebAuthn, Zod, Vitest, Playwright, and Node.js 22 LTS. Passkeys authenticate users; quick vault unlock is offered only when WebAuthn PRF succeeds, otherwise the master password or Recovery Key remains required.
