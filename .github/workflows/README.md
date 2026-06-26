# GitHub Actions Workflows

CI/CD workflows for the Order Management System (OMS).

## Active Workflows

| File | Trigger | Purpose |
|---|---|---|
| `staging-v2-deployment.yml` | Push to `staging`, `workflow_dispatch` | Build, push images, deploy to `oms-nest-staging`, run E2E |
| `codeql.yml` | Push/PR to `staging`/`main`, weekly schedule | Canonical CodeQL SAST scan |
| `ci-cd.yml` | Push/PR to `staging`/`main`, daily schedule, `workflow_dispatch` | Full DevSecOps pipeline: security scan, unit tests, E2E, image build |
| `pr-checks.yml` | PR opened/synchronised/reopened against `staging`/`main` | Code quality, security audit, API contract, performance, docs |

<!-- TODO(WF-016): ci-cd.yml and pr-checks.yml have significant overlap — both
     run linting, unit tests, dependency audits, and a backend health check.
     Before consolidating, the team should decide whether ci-cd.yml should
     replace pr-checks.yml entirely or whether the two serve distinct roles
     (pr-checks as a fast-feedback gate, ci-cd as the full nightly build).
     Do not restructure without team sign-off. -->

## Deployment Workflow (`staging-v2-deployment.yml`)

### Triggers
- Push to `staging` branch
- Manual `workflow_dispatch` with `force_deploy` option

### Pipeline
1. **Security Scan** — Trivy filesystem scan, SARIF uploaded to GitHub Security tab
2. **Backend Build** — lint, typecheck, unit tests, Docker image pushed to `ghcr.io`
3. **Frontend Build** — lint, typecheck, unit tests, Docker image pushed to `ghcr.io`
4. **Deploy to Staging** — `kubectl set image` updates running deployments in `oms-nest-staging`
5. **E2E Tests** — Playwright smoke suite against the live staging URLs
6. **Rollback** — `kubectl rollout undo` if E2E tests fail (and deploy succeeded)

### Namespace
`oms-nest-staging`

### URLs
- Frontend: `https://next-staging.ordermysaddle.com`
- Backend API: `https://api-nest-staging.ordermysaddle.com`

## Secrets

All application secrets are delivered via a **SealedSecret** committed at
`kubernetes/staging-v2/sealed-secret.yaml`. The controller decrypts it into
a Kubernetes `Secret` named `oms-app-secrets` inside `oms-nest-staging`.

No individual database or JWT secrets need to be set in GitHub repository
settings — everything is in the SealedSecret.

Required GitHub Actions secrets (infrastructure only):

| Secret | Purpose |
|---|---|
| `DIGITALOCEAN_ACCESS_TOKEN` | DigitalOcean API token (kubeconfig access) |
| `DOKS_CLUSTER_NAME` | DOKS cluster identifier |
| `CODECOV_TOKEN` | Codecov upload token (optional; `fail_ci_if_error: false` until set) |

## Shared Scripts

| Script | Used by |
|---|---|
| `scripts/wait-rollout.sh` | `staging-v2-deployment.yml` (backend + frontend wait steps) |

## Rollback

```bash
kubectl rollout undo deployment/oms-backend  -n oms-nest-staging
kubectl rollout undo deployment/oms-frontend -n oms-nest-staging
```

## Debugging

```bash
# Pod status
kubectl get pods -n oms-nest-staging -o wide

# Logs
kubectl logs -f deployment/oms-backend  -n oms-nest-staging
kubectl logs -f deployment/oms-frontend -n oms-nest-staging

# Events
kubectl get events -n oms-nest-staging --sort-by=.lastTimestamp | tail -40
```
