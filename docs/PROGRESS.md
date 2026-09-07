# Progress Log

This file is an append-only record of completed work. The current roadmap and task status live in `docs/PRODUCT_PLAN.md`.

## Entry format

```md
## YYYY-MM-DD — Phase N / Task name

- Status: Completed | Partially completed | Blocked
- Outcome: What changed or was delivered.
- Verification: Tests, reviews, commands, or manual checks performed.
- Decisions: Important product, architecture, or security decisions.
- Follow-up: Remaining work or `None`.
```

Do not record a task as completed without stating how it was verified. If later work invalidates an earlier result, append a corrective entry rather than editing history away.

## 2026-09-04 — Project planning and tracking setup

- Status: Completed
- Outcome: Added the product plan, MVP boundaries, security architecture, multi-user evolution path, delivery phases, acceptance criteria, and persistent tracking rules.
- Verification: Confirmed the repository had no existing application architecture to preserve; reviewed the new documentation for consistent phase names and status fields.
- Decisions: MVP serves one enabled user but models explicit ownership and requires cross-user authorization tests. Vault data uses a zero-knowledge client-encryption model. Every completed task or phase must update the roadmap and append a progress entry.
- Follow-up: Begin Phase 0 with the threat model, crypto-format specification, recovery flows, stack proofs of concept, and mobile wireframes.

## 2026-09-04 — Rename project to password-vault

- Status: Completed
- Outcome: Renamed the local project directory from `password-list` to `password-vault`, recorded the canonical project name, and added the phase-completion GitHub delivery policy.
- Verification: Confirmed the new directory exists at `/Users/vyhocgioi/ian-basement/password-vault` and the old directory no longer exists.
- Decisions: Push only after a whole phase satisfies its exit criteria and its documentation is updated. No push will be attempted until the GitHub remote and target branch are provided.
- Follow-up: Configure the GitHub remote when the repository URL is supplied.

## 2026-09-04 — Phase 0 / Product design and threat model

- Status: Completed
- Outcome: Delivered a threat model with trust boundaries and 16 abuse cases; versioned AES-GCM/Argon2id crypto and key-lifecycle specification; authentication, recovery, new-device, lost-device, import/export, and deletion flows; ADR for the modular-monolith stack; low-fidelity mobile wireframes; WCAG-oriented accessibility requirements; and measurable gates for Phases 1–6 and future multi-user rollout. Added crypto and WebAuthn capability proofs of concept.
- Verification: `npm run poc:crypto` passed Vault Key wrap/unwrap, item encryption/decryption, one-bit tamper rejection, and wrong-password rejection using Argon2id plus Web Crypto AES-256-GCM. The measured desktop KDF run was 36 ms and is not treated as a mobile benchmark. `npm audit --omit=dev` reported 0 vulnerabilities. JSON manifests parsed successfully, every required Phase 0 artifact was non-empty, and `git diff --check` passed.
- Decisions: Use explicit zero-knowledge client encryption; keep authentication separate from vault unlock; use passkey PRF quick unlock only after ceremony-level support is proven; use a Next.js/TypeScript modular monolith with PostgreSQL/Drizzle; cache only the public PWA shell; keep all item fields inside ciphertext; require Node.js 22 LTS before application scaffolding; and retain cross-user authorization gates from MVP.
- Follow-up: Start Phase 1. Upgrade/pin the development runtime from Node.js 18 to Node.js 22 LTS before scaffolding. Benchmark and dependency-review the Argon2id candidate on real supported phones during Phase 2.

## 2026-09-04 — Phase 1 / Application foundation and mobile prototype

- Status: Partially completed
- Outcome: Pinned Node.js 22.22.3; scaffolded Next.js 16, React 19, TypeScript, linting, Vitest, Playwright, and axe; built locked/unlock, Vault, search/filter, item detail, copy/reveal, add/edit with password generation, Favorites, Generator, Settings, light/dark, mobile bottom navigation, desktop rail, dialogs, and fixture-only state. Added a manual real-device and assistive-technology sign-off sheet.
- Verification: `npm run lint`, `npm test`, and `npm run build` passed. Search tests cover 1,000 records below the 100 ms budget. The final Playwright matrix passed 21 tests and intentionally skipped 3 duplicate exact-width runs: Android Chromium, iOS WebKit, 320 px mobile, desktop, exact 320/360/390/768/1280 widths, keyboard activation, 44 px primary targets, light/dark axe scans, and fixture usability flows. Visual screenshots were inspected at a Pixel 7 viewport. `npm audit --audit-level=high` reports 0 vulnerabilities.
- Decisions: Use a dedicated production-mode server on port 3107 for E2E isolation. Avoid third-party fonts/resources in the vault origin. Keep the phase In progress until the project owner approves the usability script and real-device VoiceOver/TalkBack checks; do not push before that gate passes.
- Follow-up: Obtain project-owner mobile, VoiceOver, TalkBack, and visual sign-off using `docs/phase-1/MANUAL_VALIDATION.md`.

## 2026-09-04 — Phase 1 / LAN mobile preview fix

- Status: Completed
- Outcome: Added the `dev:mobile` command to bind Next.js to the LAN on port 3107 and allow the current development host (`192.168.1.223`) to hydrate correctly from a phone. Removed a stale Next dev process that was occupying a conflicting port.
- Verification: Opened `http://192.168.1.223:3107` with Playwright, clicked `Unlock demo vault`, observed the `Your vault` heading, and recorded no page errors. The local route is reachable over the current machine's network interface.
- Decisions: Keep the mobile preview port explicit and separate from other local apps. If the machine's LAN IP changes, update `allowedDevOrigins` in `next.config.ts` or add the new address before testing.
- Follow-up: Run the same command from the terminal and complete the real-device/manual checklist; do not enter real credentials in this fixture prototype.

## 2026-09-04 — Phase 1 / Owner smoke test and pause

- Status: Partially completed
- Outcome: The project owner smoke-tested the Phase 1 prototype on a phone and confirmed the LAN preview and unlock interaction are usable enough to continue.
- Verification: Owner confirmed the mobile page opens through the LAN URL and the unlock buttons respond. Automated gates remain green: 21 Playwright tests passed across Android Chromium, iOS WebKit, exact responsive widths, keyboard activation, touch targets, and light/dark axe scans; unit, build, lint, and high-severity audit checks passed.
- Decisions: Push the current implementation as a checkpoint while keeping Phase 1 formally open. Do not claim VoiceOver/TalkBack, complete usability timing, or final visual approval until those manual checks are explicitly completed.
- Follow-up: Resume tomorrow with `docs/phase-1/MANUAL_VALIDATION.md`, complete the remaining real-device checks, then either close Phase 1 and move to Phase 2 or record requested UI changes.

## 2026-09-04 — Phase 2 / Client cryptography foundation

- Status: Partially completed
- Outcome: Added a browser-compatible, versioned cryptography boundary for generating and wrapping a random Vault Key; Argon2id master-password derivation; HKDF-SHA-256 recovery wrapping; strict key/item envelope parsing; per-item AES-256-GCM encryption; non-extractable in-memory Vault Keys; master-password re-wrapping; byte-array cleanup; and an in-memory lock-state primitive. Item ciphertext is bound to vault ID, item ID, and revision through authenticated additional data.
- Verification: `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build` passed. Sixteen unit tests pass, including master/recovery and Unicode round trips, wrong-secret rejection, ciphertext/nonce/tag/AAD-identity tampering, strict version/field/size checks, pre-derivation KDF bounds, 100,000 generated nonce uniqueness samples, re-wrap compatibility, failed-re-wrap preservation, and locked-session key removal.
- Decisions: Preserve master-password bytes as UTF-8 without Unicode normalization; use only reviewed `hash-wasm` Argon2id and Web Crypto AES-GCM/HKDF primitives; reject unsupported formats and resource-intensive KDF parameters before derivation; return non-extractable `CryptoKey` objects after envelope processing; and keep Phase 2 open until automatic inactivity/background locking, instrumented persistence/log/cache checks, migration coverage, and representative-phone KDF benchmarks are complete.
- Follow-up: Connect the crypto/session boundary to the client state lifecycle, implement automatic inactivity/background locking, add instrumented E2E leak checks and explicit migration orchestration tests, and benchmark Argon2id p95 on supported real phones.

## 2026-09-04 — Phase 2 / Browser secret lifecycle and leak checks

- Status: Partially completed
- Outcome: Connected the demo unlock flow to a non-extractable, in-memory Vault Key session; added five-minute inactivity locking and 30-second sustained-background locking; cleared transient selection, edit, and search state on lock; and implemented 30-second clipboard expiry that avoids overwriting newer clipboard content. Added browser instrumentation covering local storage, session storage, cookies, Cache Storage, and outgoing request bodies.
- Verification: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, and the corrected full `npm run test:e2e` matrix passed. Twenty-two unit tests pass. Playwright passed 25 tests and intentionally skipped three duplicate responsive-width cases across Android Chromium, iOS WebKit, 320 px mobile Chromium, and desktop Chromium, including the instrumented storage/cache/request leak check.
- Decisions: Treat user activity as pointer, keyboard, or touch input; require 30 continuous hidden seconds before background locking; keep the Vault Key outside React state and browser persistence; and read-before-clear so clipboard expiry never destroys content copied from another application after the vault secret.
- Follow-up: Benchmark the Argon2id v1 profile on representative supported phones. Phase 2 remains open until the mobile p95 target is recorded and approved.

## 2026-09-07 — Phase 3 / PostgreSQL ownership foundation

- Status: Partially completed
- Outcome: Started Phase 3 with Drizzle/PostgreSQL schemas and a checked-in generated migration for users, vaults, encrypted vault items, and sessions. Added explicit foreign-key ownership, one vault per user, encrypted-only item columns, revision and crypto-version constraints, soft deletion, and session token-hash storage. Implemented a repository that requires `ownerId` for list, get, create, update, delete, and export operations, including revision compare-and-swap conflict handling.
- Verification: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, and `git diff --check` passed. All 27 unit/integration tests passed; five PostgreSQL-compatible PGlite integration tests prove owner-scoped list/get, foreign-vault create denial, foreign update/delete denial, foreign export denial, and exactly one successful concurrent revision update. `npm audit --omit=dev --audit-level=high` reported 0 production vulnerabilities.
- Decisions: Enforce tenant ownership inside the repository query boundary instead of relying on route-level prechecks; give foreign and absent resources the same result; keep every vault item content field inside ciphertext; store only hashes of future session tokens; use soft deletion for encrypted blobs; and use generated Drizzle migrations with committed metadata.
- Follow-up: Add strict encrypted-envelope HTTP schemas and owner-scoped Route Handlers, then implement secure cookie sessions, CSRF/origin validation, rate limits, device revocation, and backup/restore verification. Phase 2's deferred physical-phone KDF benchmark remains outstanding.

## 2026-09-07 — Phase 3 / Encrypted API and secure sessions

- Status: Partially completed
- Outcome: Added strict Zod schemas and dynamic Next.js Route Handlers for encrypted item list/create/get/update/delete plus device-session list/revocation. Added lazy PostgreSQL wiring, opaque 256-bit session and CSRF tokens stored only as hashes, secure `__Host-` cookies, idle and absolute session expiry, same-origin and double-submit session-bound CSRF validation, disabled-user rejection, sliding idle expiry, and `Cache-Control: no-store` on every API response. Unknown/plaintext fields are rejected before repository calls.
- Verification: TypeScript, ESLint, all 36 tests, Drizzle migration validation, Next.js production build, and `git diff --check` passed. Nine new PostgreSQL-compatible integration tests cover raw-token absence, cookie attributes, active/expired/revoked sessions, same-origin CSRF, owner-scoped device revocation, encrypted-only response keys, plaintext-field rejection, foreign-vault create denial, stale revision conflict, and unauthenticated denial. The production build recognizes all six dynamic API routes.
- Decisions: Bind CSRF tokens to server-side sessions rather than relying on SameSite alone; use uniform authentication failures and uniform foreign/missing 404s; enforce envelope field allow-lists with strict validation; limit request and ciphertext size before database work; and keep database creation lazy so builds never need production credentials.
- Follow-up: Add distributed rate limiting, full HTTP-level cross-user tests for remaining route methods, session rotation at authentication integration, and encrypted backup/restore verification.

## 2026-09-07 — Phase 3 / Distributed mutation rate limits

- Status: Completed
- Outcome: Added a generated migration and atomic PostgreSQL rate-limit repository. Vault mutations now consume a shared per-user/per-operation time bucket after authentication and CSRF validation but before any ciphertext write. Bucket identifiers are SHA-256-derived so raw user IDs and operation labels are not persisted.
- Verification: `npx tsc --noEmit`, `npm run lint`, all 41 tests, `npm run db:check`, `npm run build`, and `git diff --check` passed. Rate-limit integration tests prove the exact concurrency ceiling, subject/scope/window isolation, next-window reset, and hashed storage; API tests prove an exhausted bucket returns 429 without creating an item and foreign get/update/delete operations return uniform 404 responses without mutating ciphertext. Production dependency audit remains at 0 known vulnerabilities.
- Decisions: Use database-backed atomic buckets rather than per-process memory so horizontal instances cannot bypass limits; apply mutation limits only after valid authentication to avoid attackers consuming another user's bucket; and retain expired buckets temporarily for asynchronous cleanup instead of adding deletion work to request latency.
- Follow-up: Integrate session rotation with Phase 4 authentication and verify encrypted backup/restore on a production-like PostgreSQL instance.

## 2026-09-07 — Phase 3 / Completion

- Status: Completed
- Outcome: Completed the encrypted backend and synchronization foundation: generated PostgreSQL migrations, explicit multi-user ownership, encrypted-only APIs, revision conflict handling, hashed secure sessions, session-bound CSRF, device revocation, shared database rate limits, comprehensive cross-user denial, and automated encrypted backup/restore. Added a pinned PostgreSQL Docker `pg_dump`/`pg_restore` rehearsal script for deployment checks.
- Verification: `npx tsc --noEmit`, `npm run lint`, all 42 unit/integration tests, `npm run db:check`, `npm run build`, `git diff --check`, and the full Playwright matrix passed. Playwright reported 25 passing tests and three intentional duplicate-width skips across Android Chromium, iOS WebKit, 320 px mobile Chromium, and desktop Chromium. The backup test encrypted a real item, created a physical database snapshot, restored it into a clean PostgreSQL-compatible database, matched ciphertext count/revision/digest, verified no plaintext item columns exist, and decrypted the restored record successfully. `npm audit --omit=dev --audit-level=high` reported 0 production vulnerabilities.
- Decisions: Treat the PostgreSQL-compatible physical restore as the Phase 3 automated gate and retain the PostgreSQL 17.6 Docker drill for staging/Phase 6. The Docker drill could not complete locally because the image registry pull stalled; its cleanup completed correctly. Accept four moderate development-only `drizzle-kit` transitive esbuild advisories temporarily because the offered audit fix is a breaking downgrade; the vulnerable development server is not shipped or exposed, production dependencies remain clean, and the finding must be revisited on the next Drizzle update.
- Follow-up: Begin Phase 4 passkeys and recovery. Integrate session rotation when authentication ceremonies are added, run `npm run db:verify-backup` where the pinned PostgreSQL image is available, complete Phase 2's deferred real-phone Argon2id benchmark, and repeat production-like backup restore in Phase 6.
