# Order Management System (OMS) Documentation

Welcome to the comprehensive documentation for the Order Management System (OMS) - a modern, cloud-native application designed specifically for saddle manufacturing order management.

## 📚 Documentation Overview

This documentation is organized to help developers, administrators, and stakeholders understand and work with the OMS effectively.

### 🏗️ System Components

- **[Frontend (Next.js 15)](../frontend/docs/README.md)** - React-based user interface with modern tooling
- **[E2E Testing](../e2e/README.md)** - Full application testing with Playwright
- **[Staging Deployment](./staging-deployment.md)** - Kubernetes staging deployment and DevOps

### 📖 Main Documentation

- **[Getting Started](./getting-started.md)** - Quick setup for developers
- **[System Architecture](./architecture.md)** - High-level system design
- **[API Reference](./api-reference.md)** - Complete API documentation
- **[Deployment Guide](./deployment.md)** - Production deployment instructions
- **[Staging Deployment Guide](./staging-deployment.md)** - **🆕 DevSecOps staging environment deployment**
- **[Development Workflow](./development-workflow.md)** - Team collaboration guidelines
- **[Migration Guide](./migration-readme.md)** - Production data migration
- **[Production Migration](./production-data-migration.md)** - Detailed migration plan

## 🚀 Quick Start

### For Developers

```bash
# Clone the repository
git clone git@github-iam-dev:iam-dev/oms-nest.git
cd oms_nest

# Start infrastructure (PostgreSQL, Redis, Maildev, Adminer)
cd backend && docker compose up -d postgres redis maildev adminer

# Backend setup
cd backend
npm install
cp .env.local .env
npm run migration:run
npm run seed:run:relational
npm run start:dev

# Frontend setup (new terminal — .env.local already exists)
cd frontend
npm install
npm run dev

# E2E testing (new terminal)
cd e2e
npm install
npx playwright test
```

### For System Administrators

```bash
# Deploy to Staging (Automated)
git checkout staging && git merge develop && git push origin staging

# Monitor staging deployment
kubectl get pods -n oms-nest-staging
kubectl logs -f deployment/oms-backend -n oms-nest-staging

# Health check
curl https://api-nest-staging.ordermysaddle.com/api/health
```

## 🎯 Project Context

### Business Domain

The OMS is designed for **saddle manufacturing** with specialized features for:

- **Custom saddle orders** with complex configuration options
- **Multi-stakeholder workflows** involving customers, fitters, factories, and administrators
- **Manufacturing tracking** from order placement to delivery
- **Quality control** processes and approval workflows
- **Inventory management** for leather types, hardware, and accessories

### Technology Stack

**Frontend**
- Next.js 15 with App Router
- React 19 with TypeScript
- Tailwind CSS + Shadcn/ui components
- Jotai for state management
- Playwright for E2E testing

**Backend**
- NestJS with TypeScript
- TypeORM with PostgreSQL
- JWT authentication with Passport
- Redis for caching and sessions
- Jest for unit testing

**Infrastructure**
- Docker containers
- Kubernetes orchestration
- GitHub Actions CI/CD
- DigitalOcean hosting
- Let's Encrypt SSL

### User Roles

The system supports six distinct user roles with specific permissions:

1. **USER** (Customer) - Place orders, track progress, manage profile
2. **FITTER** - Take measurements, validate orders, update status
3. **FACTORY** - Manage manufacturing, fulfill orders, track delivery
4. **CUSTOMSADDLER** - Custom saddle specialist operations
5. **ADMIN** - System administration, user management, configuration
6. **SUPERVISOR** - Oversight, approval workflows, performance monitoring

## System Components

### Backend (~47 NestJS modules)

- **Core Business**: Orders, Customers, Fitters, Factories, Users, FactoryEmployees
- **Product Catalog**: Brands, Saddles, Leathertypes, Options, OptionItems, Extras, Presets, SaddleLeathers, SaddleOptionsItems, SaddleExtras, SaddleStock, OrderProductSaddles
- **System**: Auth (JWT + Passport), RLS, Cache (Redis), EnrichedOrders (materialized views), AuditLogging, Health, Monitoring, Comments, Statuses

### Frontend (Next.js 15 App Router)

- 37 route segments, 50+ shadcn/ui components
- Generic EntityTable pattern for all entity pages
- Jotai state management, React Hook Form + Zod validation

### Infrastructure

- DigitalOcean DOKS (Kubernetes) with staging and production namespaces
- GitHub Actions CI/CD with security scanning (GitLeaks, Trivy, CodeQL)
- Docker images on GHCR, Helm charts for deployment

## 🏛️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Next.js)     │◄──►│   (NestJS)      │◄──►│   (PostgreSQL)  │
│   Port: 3000    │    │   Port: 3001    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Static Assets │    │   Authentication│    │   Redis Cache   │
│   (CDN/Local)   │    │   (JWT/Passport)│    │   (Sessions)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow

```
User Request → Frontend → API Gateway → Backend Services → Database
           ↓              ↓              ↓                ↓
      State Mgmt → Authentication → Business Logic → Data Layer
```

## 🔗 Related Resources

### External Links
- **[Project Repository](https://github.com/iam-dev/oms-nest)** - Main codebase
- **[CI/CD Pipeline](https://github.com/iam-dev/oms-nest/actions)** - Build status
- **[Issue Tracker](https://github.com/iam-dev/oms-nest/issues)** - Bug reports and features

### Development Tools
- **[Swagger UI](http://localhost:3001/docs)** - Interactive API testing (local)
- **[Docker Compose](../docker-compose.yml)** - Local development stack

### Documentation Standards
- All code must include inline documentation
- API endpoints require OpenAPI/Swagger documentation
- Database changes require migration scripts
- New features require corresponding tests

## 📞 Support & Contributing

### Getting Help
1. Check this documentation first
2. Search [existing issues](https://github.com/iam-dev/oms-nest/issues)
3. Ask in team communication channels
4. Create a new issue with detailed information

### Contributing Guidelines
1. Follow the [development workflow](./development-workflow.md)
2. Ensure all tests pass before submitting PR
3. Update documentation for new features
4. Follow established coding conventions

### Team Contacts
- **Technical Lead**: Architecture and technical decisions
- **Product Owner**: Requirements and business logic
- **DevOps**: Infrastructure and deployment
- **QA**: Testing and quality assurance

---

*This documentation is maintained by the development team and updated with each release. Last updated: February 2026*