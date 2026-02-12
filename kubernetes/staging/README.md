# Kubernetes Staging — `oms-staging` namespace

Raw kubectl manifests for the NestJS + Next.js staging environment.

| Domain | Service |
|--------|---------|
| `staging.ordermysaddle.com` | Frontend (Next.js) |
| `api-staging.ordermysaddle.com` | Backend (NestJS API) |

## Pre-deployment: clean up old PHP resources

The `oms-staging` namespace previously hosted the PHP OMS stack. Before deploying the new stack, remove old resources so there are no selector/name collisions.

```bash
# 1. List what's currently running (review before deleting)
kubectl get all -n oms-staging

# 2. Delete old workloads, services, and ingress
kubectl delete deployment,service,ingress,statefulset,configmap,pvc --all -n oms-staging

# 3. Wait for pods to terminate
kubectl wait --for=delete pods --all -n oms-staging --timeout=120s || true

# 4. Verify namespace is clean
kubectl get all -n oms-staging
```

If there's an existing Helm release from the old stack:
```bash
helm list -n oms-staging
helm uninstall <release-name> -n oms-staging
```

## Sealed secrets

Secrets are managed via [Bitnami Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets).
Both `sealed-secret.yaml` and `secrets-plain.yaml` are gitignored.

### Files

| File | Committed | Purpose |
|------|-----------|---------|
| `secrets-template.yaml` | Yes | Structure reference with `$(PLACEHOLDER)` values |
| `secrets-plain.yaml` | No | Complete plaintext secret (71 keys) — fill in and seal |
| `sealed-secret.yaml` | No | Encrypted output applied by CI |

### Option A: re-seal from running cluster (recommended)

Re-uses existing secret values from `oms-nest-staging` and re-encrypts for `oms-staging`:

```bash
kubectl get secret oms-app-secrets -n oms-nest-staging -o json \
  | jq 'del(
      .metadata.namespace,
      .metadata.resourceVersion,
      .metadata.uid,
      .metadata.creationTimestamp,
      .metadata.annotations,
      .metadata.managedFields
    )' \
  | jq '.metadata.namespace = "oms-staging"' \
  | kubeseal --format yaml \
      --namespace oms-staging \
      --controller-name sealed-secrets-controller \
      --controller-namespace kube-system \
  > kubernetes/staging/sealed-secret.yaml
```

### Option B: seal from plaintext file

Fill in real values in `secrets-plain.yaml`, then seal:

```bash
# 1. Edit secrets-plain.yaml with real values
#    (pre-filled with correct domains and sensible defaults)

# 2. Seal it
kubeseal --format yaml \
  --namespace oms-staging \
  --controller-name sealed-secrets-controller \
  --controller-namespace kube-system \
  < kubernetes/staging/secrets-plain.yaml \
  > kubernetes/staging/sealed-secret.yaml
```

### Verify sealed secret works

```bash
# Apply the sealed secret
kubectl apply -f kubernetes/staging/sealed-secret.yaml

# Wait for the controller to unseal it
kubectl get secret oms-app-secrets -n oms-staging

# Check the sealed-secrets controller logs if it fails
kubectl logs -n kube-system -l app.kubernetes.io/name=sealed-secrets
```

## DNS

Ensure these records point to the cluster's ingress-nginx LoadBalancer IP (same shared LB):

| Record | Type | Target |
|--------|------|--------|
| `staging.ordermysaddle.com` | A | `<ingress-nginx LB IP>` |
| `api-staging.ordermysaddle.com` | A | `<ingress-nginx LB IP>` |

```bash
# Find the ingress-nginx LB external IP
kubectl get svc -n ingress-nginx
```

## Manifest files

| File | Purpose |
|------|---------|
| `namespace.yaml` | Namespace + NetworkPolicy |
| `sealed-secret.yaml` | Sealed application secrets (gitignored) |
| `secrets-plain.yaml` | Complete plaintext secret, 71 keys (gitignored) |
| `secrets-template.yaml` | Secret structure reference with placeholders |
| `backend-deployment.yaml` | Backend Deployment + Service + HPA |
| `frontend-deployment.yaml` | Frontend Deployment + Service + HPA |
| `database-deployment.yaml` | Redis StatefulSet + Service |
| `ingress.yaml` | Ingress rules + ClusterIssuer (Let's Encrypt) |
| `backend-pdb.yaml` | Backend PodDisruptionBudget |
| `frontend-pdb.yaml` | Frontend PodDisruptionBudget |
| `backend-service-monitor.yaml` | Prometheus ServiceMonitor |

## Manual deploy (kubectl)

```bash
kubectl apply -f kubernetes/staging/namespace.yaml
kubectl apply -f kubernetes/staging/sealed-secret.yaml
kubectl apply -f kubernetes/staging/backend-pdb.yaml
kubectl apply -f kubernetes/staging/frontend-pdb.yaml
kubectl apply -f kubernetes/staging/backend-service-monitor.yaml
kubectl apply -f kubernetes/staging/database-deployment.yaml
kubectl apply -f kubernetes/staging/backend-deployment.yaml
kubectl apply -f kubernetes/staging/frontend-deployment.yaml
kubectl apply -f kubernetes/staging/ingress.yaml
```

## Verify

```bash
kubectl get all -n oms-staging
kubectl get ingress -n oms-staging
curl -sf https://api-staging.ordermysaddle.com/api/health
curl -sf https://staging.ordermysaddle.com
```

## Decommissioning oms-nest-staging (after migration)

Once `oms-staging` is confirmed working, remove the old namespace:

```bash
# 1. Verify new stack is healthy
curl -sf https://api-staging.ordermysaddle.com/api/health
curl -sf https://staging.ordermysaddle.com

# 2. Remove old resources
kubectl delete deployment,service,ingress,statefulset,configmap,pvc,sealedsecret --all -n oms-nest-staging
kubectl wait --for=delete pods --all -n oms-nest-staging --timeout=120s || true

# 3. Optionally delete the old namespace entirely
kubectl delete namespace oms-nest-staging
```

## Relationship to kube/helm/oms-nest

The `kube/helm/oms-nest/` directory contains a **Helm chart** for the same application. It is an alternative deployment method — this `kubernetes/staging/` directory uses raw kubectl manifests instead. The CI workflow (`staging-deployment.yml`) uses these raw manifests, **not** the Helm chart. The Helm chart can be used for local/dev environments or future migration to Helm-managed deployments.
