# Deployment Guide (Production)

This guide summarizes the steps to take the Private Messaging App from dev to a production(-like) environment.

## 1. Prepare Smart Contract
1. Review and (optionally) reformat `contracts/private-messaging.clar` for readability (current form is compact).
2. Run static analysis:
   - `clarinet check`
   - Resolve or accept warnings; document any accepted risks in `SECURITY.md`.
3. (Optional) Add property-based or scenario tests in `tests/` (pagination edges, read receipts, invalid calls).
4. Deploy to Testnet:
   - Use Leather wallet or `clarinet deploy --network testnet` (if supported) / Stacks CLI.
   - Record: deployer principal, tx id, block height.
5. Verify functions:
   - call `get-profile` (should return none for fresh account)
   - register & send sample message; ensure pagination returns expected counts.
6. Mainnet deployment only after code freeze + external review.

## 2. Pin Contract Address
Update environment:
- Front-end: `web/.env` set `VITE_CONTRACT_ADDRESS=ST...::private-messaging` and `VITE_STACKS_NETWORK=testnet|mainnet`.
- Backend: `backend/.env` set `CONTRACT_ADDRESS=ST...::private-messaging`.

Commit (without secrets) so build artifacts are reproducible.

## 3. Front-End Production Build
```
cd web
npm ci
npm run build
```
Artifacts appear in `web/dist/`.

## 4. Containerization
Dockerfiles provided:
- `backend/Dockerfile`
- `web/Dockerfile` (builds static assets then serves via nginx)

Build images:
```
docker compose build
```
Run locally:
```
docker compose up -d
```
Access: http://localhost:5173 (nginx container) & http://localhost:4000 (backend)

## 5. Production Hosting Options
### Option A: Single VPS
- Reverse proxy (Caddy / Nginx) in front of both services.
- Obtain TLS cert (LetsEncrypt) for domain (e.g., `app.example.com`).
- Serve SPA behind caching (immutable hashed assets).

### Option B: Static Hosting + Serverless
- Build front-end, deploy `dist/` to CDN (Netlify, Vercel, Cloudflare Pages, S3+CloudFront).
- Backend (if expanded) -> serverless functions (Cloudflare Workers / AWS Lambda) or remove entirely if pure on-chain + direct Hiro API calls.

### Option C: All Serverless (Minimal)
- Remove backend; front-end directly queries Hiro API and executes contract calls. (Current front-end already close to this model.)

## 6. Environment & Secrets
Currently no secrets required (pure client chain interactions). If backend indexing added:
- Store API keys / database URLs via platform secrets store (not committed).
- Add `.env.production` pattern if needed.

## 7. Observability
- Enable access logs (nginx) with IP anonymization.
- Front-end error tracking (Sentry) — strip PII, never log decrypted plaintext.
- Uptime checks for static site + (optional) backend.

## 8. Security Hardening
- Enforce HTTPS + HSTS (Strict-Transport-Security header).
- Add CSP + X-Frame-Options, Referrer-Policy, Permissions-Policy.
- Avoid inline scripts (Vite build already hashes code) or allow `'self'` only.
- Audit dependencies: `npm audit --production` (CI fail on high severity).
- Consider subresource size normalization (pad ciphertext) to reduce metadata leakage.

## 9. Versioning & Releases
- Tag repository with `vX.Y.Z` after each contract-compatible release.
- If contract upgrade (new address) required, bump major version and document migration path.

## 10. Post-Deployment Checklist
| Item | Status |
|------|--------|
| Contract deployed (testnet) |  |
| Contract verified on Explorer |  |
| Contract address pinned in `.env` |  |
| Front-end build reproducible |  |
| Docker images built & tagged |  |
| HTTPS & security headers |  |
| Monitoring & error tracking |  |
| Documentation updated |  |
| Backup / snapshot strategy (off-chain indexes) |  |

## 11. Rollback Strategy
- Front-end: Re-deploy previous image / static build (retain last N builds).
- Contract: Immutable—deploy new contract (v2) and update front-end env var. Encourage users to re-register.

## 12. Future Production Enhancements
- Add API indexer for faster inbox queries (subscribe to chain events) and caching layer.
- Implement message batching & compression.
- Add group chat contract extension.
- Expand test matrix with simulated high-volume messaging.

---
Keep this file updated as your architecture evolves.
