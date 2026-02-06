# Staging Deployment Guide

## Overview

This guide covers deploying the Order Management System (OMS) to the **oms-nest-staging** Kubernetes namespace on DigitalOcean DOKS (AMS3 region) using automated DevSecOps pipelines. The staging environment provides a production-like environment for testing new features, integrations, and security updates.

## Quick Start

### Automated Deployment (Recommended)
```bash
# Merge develop into staging to trigger deployment
git checkout staging && git merge develop && git push origin staging

# Or manually trigger from GitHub Actions UI (workflow_dispatch)
```

### Manual Deployment
```bash
# Set up environment variables
cp .env.staging.template .env.staging
# Edit .env.staging with actual values

# Deploy using kubectl apply
kubectl apply -f kubernetes/staging-v2/
```

## Environment Details

### Infrastructure
- **Namespace**: `oms-nest-staging`
- **Cluster**: DigitalOcean Kubernetes
- **Ingress**: NGINX with SSL termination
- **Storage**: DigitalOcean Block Storage
- **Registry**: GitHub Container Registry (GHCR)

### Services
- **Frontend**: Next.js 15 application
- **Backend**: NestJS API server
- **Database**: PostgreSQL 17 (DO Managed, external, port 25060, SSL enabled)
- **Cache**: Redis 7 for sessions and caching
- **Monitoring**: Prometheus metrics collection

### URLs
- **Frontend**: https://next-staging.ordermysaddle.com
- **Backend API**: https://api-nest-staging.ordermysaddle.com
- **API Docs**: https://api-nest-staging.ordermysaddle.com/docs
- **Health Check**: https://api-nest-staging.ordermysaddle.com/api/health

## Deployment Methods

### 1. GitHub Actions Workflow (Recommended)

The automated CI/CD pipeline provides comprehensive DevSecOps capabilities:

#### Pipeline Stages
1. **Security Scan**: Trivy vulnerability scanning
2. **Backend Build**: Lint, test, build Docker image
3. **Frontend Build**: Lint, test, build Docker image
4. **Deploy**: Kubernetes deployment with rolling updates
5. **E2E Tests**: Automated validation testing
6. **Notify**: Slack notifications on completion

#### Trigger Options

**Automatic Trigger**:
- Push to `staging` branch (e.g., merging `develop` into `staging`)

**Manual Trigger**:
1. Go to GitHub Actions
2. Select "Deploy to Staging"
3. Click "Run workflow"
4. Choose environment options

#### Required GitHub Secrets

Configure in **Settings** → **Secrets and variables** → **Actions**:

```bash
# Database
DB_USERNAME=staging_db_user
DB_PASSWORD=secure_db_password
DB_HOST=your-postgres-host.com
DB_NAME=oms_staging_v2

# Application
JWT_SECRET_KEY=your-32-character-jwt-secret
ENCRYPTION_SECRET=your-encryption-secret

# Infrastructure
DIGITALOCEAN_ACCESS_TOKEN=your-do-token
REDIS_HOST=your-redis-host.com
REDIS_PASSWORD=your-redis-password

# Testing (Optional)
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test_password

# Notifications (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

### 2. Manual Script Deployment

For local development or troubleshooting:

#### Prerequisites
```bash
# Install required tools
brew install kubectl doctl docker

# Authenticate with services
doctl auth init
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin
```

#### Environment Setup
```bash
# Copy and configure environment
cp .env.staging.template .env.staging

# Edit with your values:
# - Database credentials
# - Application secrets
# - Infrastructure tokens
```

#### Execute Deployment
```bash
kubectl apply -f kubernetes/staging-v2/
```

## Architecture

### Container Images
- **Backend**: `ghcr.io/iam-dev/oms-nest-backend:latest`
- **Frontend**: `ghcr.io/iam-dev/oms-nest-frontend:latest`

### Kubernetes Resources

#### Namespace
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: oms-nest-staging
  labels:
    environment: staging
    project: oms
```

#### Core Services
- **PostgreSQL**: DO Managed database (external, port 25060, SSL enabled)
- **Redis Deployment**: Cache and session storage (in-cluster, no persistence in staging)
- **Backend Deployment**: NestJS API with 2 replicas (HPA: 2-6)
- **Frontend Deployment**: Next.js app with 1 replica (HPA: 1-4)

#### Security Features
- **Network Policies**: Traffic isolation between namespaces
- **Pod Security Contexts**: Non-root containers, read-only filesystems
- **RBAC**: Least-privilege service accounts
- **Secret Management**: Bitnami SealedSecrets (encrypted in Git, auto-decrypted by controller)

#### High Availability
- **Horizontal Pod Autoscaler**: Auto-scaling based on CPU/memory
- **Rolling Updates**: Zero-downtime deployments
- **Health Checks**: Liveness and readiness probes
- **Resource Limits**: Memory and CPU constraints

## Monitoring & Observability

### Health Endpoints
```bash
# Application health (liveness)
curl https://api-nest-staging.ordermysaddle.com/api/health/live

# Application health (readiness)
curl https://api-nest-staging.ordermysaddle.com/api/health/ready

# Frontend health
curl https://next-staging.ordermysaddle.com/api/health
```

### Kubernetes Monitoring
```bash
# Pod status
kubectl get pods -n oms-nest-staging

# Service endpoints
kubectl get services -n oms-nest-staging

# Ingress configuration
kubectl get ingress -n oms-nest-staging

# Resource usage
kubectl top pods -n oms-nest-staging
```

### Application Logs
```bash
# Backend application logs
kubectl logs -f deployment/oms-backend -n oms-nest-staging

# Frontend application logs
kubectl logs -f deployment/oms-frontend -n oms-nest-staging

# Redis logs
kubectl logs -f deployment/oms-redis -n oms-nest-staging
```

### Metrics Collection
- **Prometheus**: Application metrics at `/metrics` endpoints
- **Custom Metrics**: Business logic performance indicators
- **Infrastructure Metrics**: Kubernetes cluster resource usage

## Testing & Validation

### Automated E2E Tests
The deployment pipeline includes comprehensive end-to-end testing:

```bash
# Run tests locally against staging
cd e2e
npm run test:staging
```

#### Test Coverage
- **Health Checks**: All services responding correctly
- **Authentication**: JWT token validation and protected endpoints
- **API Endpoints**: All core business entities accessible
- **Security**: CORS headers, security headers, rate limiting
- **Performance**: Page load times and response times
- **Cross-browser**: Chrome, Firefox, Safari, mobile devices

### Manual Testing Checklist

#### Pre-deployment
- [ ] Environment secrets configured
- [ ] Database backup completed
- [ ] Network connectivity verified
- [ ] Resource quotas checked

#### Post-deployment
- [ ] All pods running and healthy
- [ ] Health endpoints returning 200 OK
- [ ] Database migrations completed successfully
- [ ] Frontend application loads without errors
- [ ] API documentation accessible
- [ ] Authentication flow working
- [ ] CORS configuration correct
- [ ] SSL certificates valid

#### Performance Validation
- [ ] Frontend loads within 3 seconds
- [ ] API responses under 100ms for simple queries
- [ ] Database queries optimized
- [ ] Memory usage within limits
- [ ] CPU utilization normal

## Troubleshooting

### Common Issues

#### Pods Not Starting
```bash
# Check pod events
kubectl describe pod <pod-name> -n oms-nest-staging

# Check resource limits
kubectl get pods -o wide -n oms-nest-staging

# Review logs
kubectl logs <pod-name> -n oms-nest-staging
```

#### Database Connection Issues
```bash
# Check database secrets
kubectl get secret oms-app-secrets -n oms-nest-staging -o yaml

# Test connectivity from a backend pod
kubectl exec -it deployment/oms-backend -n oms-nest-staging -- node -e "require('pg').Pool({}).query('SELECT 1')"
```

#### Image Pull Errors
```bash
# Check registry credentials
kubectl get secret registry-credentials -n oms-nest-staging -o yaml

# Verify image tags
kubectl describe deployment/oms-backend -n oms-nest-staging
```

#### SSL/Ingress Issues
```bash
# Check ingress status
kubectl describe ingress oms-nest-staging-ingress -n oms-nest-staging

# Verify TLS certificates
kubectl get certificate -n oms-nest-staging

# Test DNS resolution
nslookup next-staging.ordermysaddle.com
```

### Recovery Procedures

#### Rollback Deployment
```bash
# View rollout history
kubectl rollout history deployment/oms-backend -n oms-nest-staging

# Rollback to previous version
kubectl rollout undo deployment/oms-backend -n oms-nest-staging
kubectl rollout undo deployment/oms-frontend -n oms-nest-staging

# Check rollback status
kubectl rollout status deployment/oms-backend -n oms-nest-staging
```

#### Emergency Scale Down
```bash
# Scale to zero (maintenance mode)
kubectl scale deployment/oms-backend --replicas=0 -n oms-nest-staging
kubectl scale deployment/oms-frontend --replicas=0 -n oms-nest-staging
```

#### Database Recovery
```bash
# Connect to the DO Managed PostgreSQL directly using psql (requires credentials)
# Or run migrations from a backend pod:
kubectl exec -it deployment/oms-backend -n oms-nest-staging -- npm run migration:run
```

## Security Considerations

### Data Protection
- All environment variables stored as Kubernetes secrets
- Database passwords never logged or exposed
- JWT secrets rotated regularly
- SSL/TLS encryption for all external traffic

### Network Security
- Network policies restrict inter-pod communication
- Ingress controller provides WAF protection
- Rate limiting prevents abuse
- CORS properly configured for frontend origins

### Container Security
- Non-root containers with minimal privileges
- Read-only root filesystems where possible
- Security contexts enforce resource constraints
- Regular vulnerability scanning with Trivy

### Access Control
- RBAC policies limit Kubernetes access
- Service accounts use least-privilege principles
- Audit logging enabled for all administrative actions

## Performance Optimization

### Resource Allocation
```yaml
# Backend resources
requests:
  memory: "512Mi"
  cpu: "250m"
limits:
  memory: "2Gi"
  cpu: "1000m"

# Frontend resources
requests:
  memory: "128Mi"
  cpu: "100m"
limits:
  memory: "512Mi"
  cpu: "500m"
```

### Auto-scaling Configuration
- **HPA**: Scales pods based on CPU/memory usage
- **VPA**: Adjusts resource requests automatically
- **Cluster Autoscaler**: Adds nodes when needed

### Caching Strategy
- **Redis**: Session storage and API response caching
- **CDN**: Static asset delivery optimization
- **Database**: Connection pooling and query optimization

## Maintenance

### Regular Tasks
- [ ] Weekly security updates
- [ ] Monthly dependency updates
- [ ] Quarterly disaster recovery testing
- [ ] Bi-annual security audits

### Backup Procedures
```bash
# Database backup (DO Managed PostgreSQL — use doctl or the DigitalOcean console for backups)
# Managed databases have automatic daily backups

# Configuration backup
kubectl get all -n oms-nest-staging -o yaml > k8s-backup.yaml
```

### Update Procedures
1. Test changes in development environment
2. Update container images
3. Apply Kubernetes manifests
4. Run E2E test suite
5. Monitor application health
6. Notify stakeholders of completion

## Support

### Documentation
- [Architecture Overview](./architecture.md)
- [Development Workflow](./development-workflow.md)
- [API Reference](./api-reference.md)
- [Getting Started](./getting-started.md)

### Contact Information
- **DevOps Team**: #devops Slack channel
- **On-call Engineer**: Check PagerDuty rotation
- **Development Team**: #development Slack channel
- **Security Team**: security@ordermysaddle.com

### Emergency Contacts
- **Production Issues**: Call PagerDuty escalation
- **Security Incidents**: security-incident@ordermysaddle.com
- **Infrastructure Issues**: infrastructure@ordermysaddle.com

---

## Quick Reference

### Essential Commands
```bash
# Deploy to staging (merge develop → staging)
git checkout staging && git merge develop && git push origin staging

# Check deployment status
kubectl get pods -n oms-nest-staging

# View application logs
kubectl logs -f deployment/oms-backend -n oms-nest-staging

# Rollback deployment
kubectl rollout undo deployment/oms-backend -n oms-nest-staging

# Run E2E tests
cd e2e && npm run test:staging

# Health check
curl https://api-nest-staging.ordermysaddle.com/api/health
```

### Key URLs
- **Frontend**: https://next-staging.ordermysaddle.com
- **API**: https://api-nest-staging.ordermysaddle.com
- **Docs**: https://api-nest-staging.ordermysaddle.com/docs
- **Health**: https://api-nest-staging.ordermysaddle.com/api/health