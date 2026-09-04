# Phase 0 Primary References

Reviewed on 2026-09-04. Versions and recommendations must be rechecked before security-sensitive dependency upgrades.

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) — Argon2id and parameter baseline.
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) — authenticated encryption, randomness, and key management.
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) — secure cookie attributes, timeouts, cache controls, and token storage.
- [W3C Web Authentication Level 3](https://www.w3.org/TR/webauthn-3/) — WebAuthn security model and ceremonies.
- [MDN SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) and [AES-GCM parameters](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) — Web Crypto availability, secure-context requirement, and unique IV invariant.
- [SimpleWebAuthn browser documentation](https://simplewebauthn.dev/docs/packages/browser/) and [server documentation](https://simplewebauthn.dev/docs/packages/server) — browser/server ceremony APIs and RP verification.
- [SimpleWebAuthn PRF documentation](https://simplewebauthn.dev/docs/advanced/prf) and [Safari notes](https://simplewebauthn.dev/docs/advanced/browser-quirks) — feature-gated quick unlock and native user-gesture constraints.
- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) and [CSP guide](https://nextjs.org/docs/app/guides/content-security-policy) — application-shell/PWA setup and strict CSP tradeoffs.
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations) — checked-in code-first SQL migration workflow.
- [Playwright device emulation](https://playwright.dev/docs/next/emulation) and [accessibility testing](https://playwright.dev/docs/accessibility-testing) — mobile and automated accessibility test approach.
