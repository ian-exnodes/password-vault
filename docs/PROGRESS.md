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
