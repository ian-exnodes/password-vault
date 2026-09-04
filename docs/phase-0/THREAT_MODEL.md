# Threat Model

Status: Phase 0 baseline

Method: asset/trust-boundary analysis plus STRIDE-style abuse cases. This is a living document and must be reviewed whenever authentication, cryptography, sharing, imports, attachments, or deployment topology changes.

## Scope and security goals

The system is a hosted, mobile-first vault. The browser receives encrypted records, decrypts them only after an explicit unlock, and sends only encrypted records back. The MVP enables one user, while authorization remains owner-scoped and testable with at least two fixture users.

Primary goals:

- Confidentiality and integrity of vault contents if the database, backups, object storage, or API responses are stolen.
- Strong authentication resistant to phishing and credential stuffing.
- Tenant isolation before public multi-user enrollment exists.
- Recoverability from a lost device without giving the server access to plaintext.
- Safe failure: authentication, decryption, authorization, and version mismatches fail closed.

Availability against a determined infrastructure attacker and confidentiality on a fully compromised endpoint are not guaranteed. These limits must be stated to users.

## Assets

| Asset | Required property | Permitted location |
|---|---|---|
| Master password | Confidential; never transmitted or persisted | User memory and short-lived client memory |
| Vault Key | Confidential and integrity protected | Client memory; server only as wrapped ciphertext |
| Recovery Key | Confidential and high entropy | User-controlled offline storage; short-lived client memory |
| Vault plaintext | Confidential and integrity protected | Unlocked client memory only |
| Encrypted records | Integrity/version protected | Client, API, database, backups |
| Session ID | Confidential, revocable, time bounded | HttpOnly secure cookie and server session store |
| Passkey private key | Non-exportable where authenticator provides it | Authenticator only |
| Audit/security events | Integrity and privacy | Server logs without secrets or vault metadata |

## Trust boundaries

1. Human ↔ browser/device: shoulder surfing, phishing, clipboard readers, lost/unlocked phone.
2. Browser application ↔ third-party dependencies: supply-chain code executes in the decryption origin.
3. Browser ↔ API over TLS: authentication, CSRF, replay, caching, and traffic metadata.
4. API ↔ PostgreSQL/backups: authorization errors and exfiltration.
5. Deployment/control plane ↔ application: a compromised deployment can serve malicious JavaScript and capture future unlocks.
6. User A ↔ User B: future tenant boundary, tested from MVP even when registration is disabled.

## Threat actors

- Remote unauthenticated attacker.
- Phisher or credential-stuffing attacker.
- Attacker with a database or backup dump.
- Attacker holding a lost device, either locked or already unlocked.
- Malicious or compromised dependency/CDN.
- Compromised application server or deployment account.
- Another authenticated user attempting horizontal privilege escalation.
- Accidental user action such as deletion, lost recovery material, or importing malformed data.

## Abuse cases and controls

| ID | Threat | Impact | Required controls | Residual risk |
|---|---|---|---|---|
| T01 | Database/backup theft | Offline guessing and metadata disclosure | Argon2id; unique salt; high-entropy Recovery Key; AES-GCM; minimal metadata | Weak master passwords remain guessable; record count/size/timestamps may leak |
| T02 | API authorization bypass/IDOR | Cross-user ciphertext read or mutation | Owner scope every query; opaque IDs; deny by default; two-user negative tests | Ciphertext and metadata still matter even if unreadable |
| T03 | Stored/reflected/DOM XSS | Plaintext and key theft while unlocked | Strict CSP; no third-party scripts; safe rendering; dependency review; no HTML injection | Compromised first-party bundle can capture unlocks |
| T04 | Malicious deployment/server | Serve key-stealing JavaScript | Protected CI/CD, signed/reviewed releases, CSP, restricted deploy access, monitoring | Web zero-knowledge cannot protect future unlocks from malicious delivered JS |
| T05 | Session theft | Unauthorized encrypted-vault access and destructive actions | HttpOnly Secure SameSite cookie; rotation; idle/absolute expiry; revoke devices; re-auth sensitive actions | Stolen active browser context can act until locked/revoked |
| T06 | CSRF | Unauthorized mutations/session changes | SameSite=Strict, origin checks, CSRF token for state changes | Browser bugs/misconfiguration |
| T07 | Login/passkey replay | Account takeover | Server-generated single-use challenges with short TTL; verify RP ID, origin, UV, counter where useful | Synced-passkey counter semantics vary |
| T08 | Lost or stolen phone | Read unlocked vault or reuse session | OS lock, WebAuthn UV, background/idle auto-lock, remote session revoke, no plaintext cache | Malware or an already-unlocked device may expose data |
| T09 | Clipboard exfiltration | Password disclosure to other apps | Explicit copy, clear after 30 seconds by default, warn that OS clipboard history may retain data | Browser cannot guarantee erasure from OS history |
| T10 | Nonce reuse | AES-GCM confidentiality/integrity failure | 96-bit CSPRNG nonce per encryption; key rotation/versioning; automated uniqueness tests | Random collision is negligible, implementation bugs are not |
| T11 | Ciphertext substitution/rollback | Wrong-item data or old password restored | Bind envelope metadata in AAD; monotonic revision/conflict rules; authenticated version/type/item ID | A server controlling all history can withhold newer versions unless externally anchored |
| T12 | Malformed import/decryption bomb | Crash or resource exhaustion | Size/count limits; schema/version validation before decrypt/parse; transactional import | Valid but huge user vaults require explicit limits |
| T13 | Secret leakage in logs/telemetry/cache | Persistent disclosure | Structured allow-list logging; no request bodies; no analytics in vault; no-store; redact identifiers | Hosting/network traffic metadata remains visible |
| T14 | Dependency compromise | Key/plaintext exfiltration | Minimal dependencies, lockfile, pinned versions, automated audit, review updates, self-host WASM | No package ecosystem eliminates supply-chain risk |
| T15 | Account/recovery enumeration | Privacy leak and targeted attacks | Uniform public responses and timing; rate limiting; do not expose recovery status | Email delivery metadata if email is later added |
| T16 | Deletion/ransom/availability failure | Vault loss | Soft-delete window for encrypted blobs, encrypted backups, restore drills | Server can deny availability; zero knowledge does not solve availability |

## Explicit non-goals for MVP

- Protecting plaintext from a compromised browser, OS, keyboard, screenshot service, or malicious extension while the vault is unlocked.
- Hiding access timing, IP address, total vault size, record count, or ciphertext length from the service.
- Browser autofill or extension security.
- Secure multi-party sharing.
- Server-assisted recovery that bypasses the user's master/recovery secret.

## Security gates

- Any dependency able to execute in the vault origin requires review.
- Any new plaintext field requires a threat-model update.
- Public registration cannot launch before tenant-isolation tests pass.
- Sharing cannot launch before per-member key wrapping, removal rotation, and role authorization are specified and tested.
- Real credentials cannot be used before Phase 6 go/no-go approval.
