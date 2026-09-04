# ADR-0001: Technical Architecture and Stack

- Status: Accepted for implementation, with version pins selected during scaffolding
- Date: 2026-09-04

## Context

The product is a mobile-first, zero-knowledge web vault. It needs strong TypeScript boundaries, a small deployable architecture, browser cryptography, passkeys, PostgreSQL ownership rules, PWA behavior, and automated mobile/security tests. The MVP has one enabled user but must not depend on singleton-user assumptions.

## Decision

Use a modular monolith:

- Next.js App Router with TypeScript for UI and server endpoints.
- React client components only where vault state or browser cryptography is required; keep secrets out of Server Components and server actions.
- PostgreSQL with Drizzle ORM and checked-in SQL migrations.
- Web Crypto API for AES-GCM, HKDF, random bytes, and non-extractable runtime keys.
- `hash-wasm` as the initial Argon2id WASM candidate, pinned and self-hosted in the application bundle. Reassess it during Phase 2 dependency review and mobile benchmarking.
- SimpleWebAuthn browser/server packages for passkey ceremonies; require user verification and exact RP ID/origin validation.
- Zod at HTTP, encrypted-envelope, import, and environment boundaries.
- Vitest for unit/integration tests; Playwright plus axe-core for browser, mobile-emulation, and automated accessibility checks.
- Docker image running Node.js 22 LTS or a later supported LTS pinned by the repository; PostgreSQL deployed separately.

Do not introduce analytics, a tag manager, remotely hosted scripts, or a general-purpose client state library in the vault origin for MVP.

## Architecture boundaries

```text
Mobile browser / installed PWA
  ├─ UI and unlocked in-memory state
  ├─ Crypto module (never imported by server modules)
  └─ Auth/API client
          │ TLS + HttpOnly session cookie
          ▼
Next.js BFF / API
  ├─ Authentication and session service
  ├─ Owner-scoped vault ciphertext service
  ├─ Security-event service
  └─ PostgreSQL repository
          │
          ▼
PostgreSQL + encrypted backups
```

Enforce boundaries with separate modules, server-only/client-only guards, lint rules against logging restricted names, and tests demonstrating the server schemas have no vault-plaintext fields.

## PWA decision

The service worker caches only versioned public application-shell assets. It must not cache authenticated HTML, API traffic, vault envelopes, plaintext, session responses, or exports. Offline decryption/synchronization is deferred until an encrypted IndexedDB design receives its own threat-model review.

## CSP decision

Use a strict production CSP with same-origin scripts and no `unsafe-eval`. Choose per-request nonces if Next.js runtime output requires inline scripts; accept dynamic rendering on authenticated pages. Do not adopt experimental SRI as the primary defense. Report-only CSP precedes enforcement during staging.

## Passkey decision

SimpleWebAuthn handles registration and authentication ceremonies. Passkeys authenticate the account. Quick vault unlock is separately feature-detected through WebAuthn PRF during a real ceremony; capability detection alone is insufficient. Safari flows begin from a native click and avoid unrelated async work before the ceremony.

## Proof-of-concept results

`poc/crypto-poc.mjs` validates:

- Argon2id derives a 256-bit KEK in the selected browser-compatible WASM package.
- AES-256-GCM wraps/unwraps a random Vault Key.
- AES-256-GCM encrypts/decrypts a JSON item with AAD.
- A one-bit ciphertext change is rejected.
- A wrong master password cannot unwrap the Vault Key.

`poc/webauthn-capability.html` provides a native-click browser probe for secure context, WebAuthn, platform authenticator, and conditional mediation. Full PRF verification requires HTTPS, RP configuration, and a server ceremony and therefore belongs to Phase 4.

## Alternatives considered

- Separate SPA plus API: clearer physical separation but two deployments and more cross-origin/session complexity for a small MVP.
- Prisma: mature and productive, but Drizzle plus checked-in SQL gives more direct visibility into owner-scoped queries and migrations.
- PBKDF2 only: natively available but not memory-hard; retained only as a possible standards/compliance fallback, not the default.
- `argon2-browser`: proven in browser use, but its older bundling ergonomics make `hash-wasm` the initial POC candidate. Phase 2 must revisit maintenance and supply-chain risk before production.
- Passkey as the only decryption secret: rejected because authentication availability and portable recovery must remain explicit; PRF support is not universal.
- Native app first: rejected because a PWA better matches the requested delivery speed and cross-platform reach.

## Consequences

- A single repository and deployment remain manageable for a personal MVP.
- Strict client/server secret boundaries require discipline in Next.js.
- A compromised application deployment can still deliver malicious JavaScript; operational hardening is part of the security model.
- Node.js 18 currently installed in the development environment is below the selected Next.js runtime floor. Scaffolding must upgrade/pin Node.js 22 LTS before Phase 1 implementation.
- Argon2id unlock cost must be benchmarked on real supported phones rather than copied blindly from desktop results.

## Revisit triggers

- `hash-wasm` fails dependency review, CSP/WASM loading, or phone performance targets.
- Next.js makes strict CSP or client/server boundaries impractical.
- Offline mode, attachments, browser extensions, sharing, or native apps enter scope.
- Public multi-user registration is scheduled.
