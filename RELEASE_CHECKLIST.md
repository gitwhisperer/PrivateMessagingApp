## Release Checklist (Production)

1. Contract
   - [ ] `clarinet check` clean (warnings reviewed / documented)
   - [ ] Test suite green (`pma` project tests)
2. Versioning
   - [ ] Set APP_VERSION env var (e.g. export APP_VERSION=v0.1.0)
   - [ ] Tag git commit (`git tag v0.1.0 && git push --tags`)
3. Frontend
   - [ ] `cp web/.env.example web/.env` and set real `VITE_CONTRACT_ADDRESS`
   - [ ] `npm run build` (outputs in `web/dist`)
   - [ ] Container build ok (`docker build -t pma-web:0.1.0 web`)
4. Backend (optional)
   - [ ] Backend .env configured (`CONTRACT_ADDRESS`, `STACKS_NETWORK`, `CORS_ORIGIN`)
   - [ ] `docker build -t pma-backend:0.1.0 backend`
5. Compose / Deployment
   - [ ] Update image tags in infra manifests
   - [ ] Deploy to staging; run smoke: connect wallet, register, send msg, fetch inbox
6. Security
   - [ ] `npm audit --omit=dev` (no high/critical) for backend & web
   - [ ] Dependency review; update base images
   - [ ] Validate CSP if added (currently via nginx; extend with script-src 'self')
7. Observability
   - [ ] Enable logging & metrics (reverse proxy, container logs)
   - [ ] Add uptime check to /health or /healthz
8. Docs
   - [ ] Update `DEPLOYMENT.md` with new contract address
   - [ ] Update `SECURITY.md` with any accepted risks
9. Rollback Plan
   - [ ] Previous images retained
   - [ ] Frontend revert = redeploy prior tag
10. Post-Deploy
   - [ ] Verify explorer shows contract tx
   - [ ] Test two-wallet messaging on production domain

Keep this file updated per release.