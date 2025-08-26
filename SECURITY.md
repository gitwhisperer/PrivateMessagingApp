# Security Guide for Private Messaging App

This document highlights the security posture and deployment hardening steps.

## Smart Contract
- Immutable storage of ciphertext; no deletion. Consider adding message size normalization to reduce traffic analysis.
- All validation uses asserts; review gas costs before mainnet deploy.
- Add a test harness for edge cases (empty usernames, oversized ciphertext, mark-read by non-participant) prior to mainnet.

## Front-End
- Never log decrypted plaintext in production builds.
- Enforce HTTPS and a strict CSP header (see example below) when serving the SPA.
- Use Subresource Integrity (SRI) only if referencing external scripts (currently none).

Example CSP (adjust domains as needed):
```
Content-Security-Policy: default-src 'self'; connect-src 'self' https://api.testnet.hiro.so https://api.hiro.so; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';
```

## Backend
- Currently minimal. If expanded (e.g., indexing), implement rate limiting (e.g., token bucket), request logging with redaction, and input validation.

## Keys & Encryption
- Registration stores a compressed secp256k1 public key; actual encryption strategy should use ECIES or X25519 + symmetric AEAD.
- Never store private keys server-side. Wallet handles keys; encryption derives shared secret client-side.

## Dependency / Supply Chain
- Use `npm audit --production` in CI. Pin versions via lockfile.

## Deployment Checklist
- [ ] Clarinet audit / static analysis passes (no new warnings) 
- [ ] Contract ID pinned in front-end `.env` (built artifact should not rely on dynamic user override if you want a fixed deployment)
- [ ] CSP & security headers configured on CDN / nginx
- [ ] HTTPS certificates (LetsEncrypt / managed cert) in place
- [ ] Monitoring & log aggregation configured (exclude sensitive data)

## Incident Response
- If a critical contract bug: publish mitigation guidance (cannot patch immutable contract). Optionally deploy upgraded contract and migrate user registration state via off-chain snapshot + user opt-in re-register.

## Responsible Disclosure
Report vulnerabilities via private email (add contact method here) before public disclosure. Provide reproduction steps and potential impact.
