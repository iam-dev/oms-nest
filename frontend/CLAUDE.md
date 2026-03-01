# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- **Development server**: `npm run dev` - Uses Turbopack for fast builds and hot reloading
- **Production build**: `npm run build`
- **Production server**: `npm start`
- **Linting**: `npm run lint` - ESLint with Next.js config
- **Testing**: `npm test` - Jest with React Testing Library

### API Backend
- **Backend URL**: `http://localhost:8888` (configurable via `NEXT_PUBLIC_API_URL`)
- **Docker services**: Start full stack with `docker-compose up` from parent directory
- **Database restoration**: Use `../restore_local_db.sh` for local development setup

## Architecture Overview

### Multi-Service Architecture
This is a **microservices-based Order Management System** with:
- **Next.js 15 frontend** (this repository) with React 19 and Turbopack
- **PHP/Symfony API backend** (../api) with API Platform
- **PostgreSQL database** for data persistence
- **Redis cache** for session management
- **RabbitMQ** for message queuing
- **Varnish proxy** for API caching

### Business Domain: Saddle Manufacturing
Specialized for equestrian/saddle manufacturing with entities:
- **Orders**: Complex workflow with status management and urgency flags
- **Products**: Brands, models, leather types, options, extras, presets
- **Users**: Multi-role system (Admin, User, Fitter, Supplier, Supervisor)
- **Manufacturing**: Saddle-specific attributes like seat sizes, measurements

### Authentication & Authorization
- **httpOnly cookie-based JWT authentication** (server sets secure cookies, browser sends automatically)
- **Role-based access control** with middleware protection
- **User roles**: Admin, User, Fitter, Supplier, Supervisor
- **Route protection**: Middleware checks roles for page access

## Key Technical Components

### Generic Entity System
- **EntityTable component** (`components/shared/EntityTable.tsx`): Reusable table for all entities
- **TableHeaderFilter system**: Configurable filters (Text, Date, Boolean, Number, Enum)
- **useEntityData hook**: Generic data fetching with pagination and filtering
- **Entity services**: Centralized API calls in `services/` directory

### API Integration
- **Centralized API service** (`services/api.ts`): Shared authentication headers and error handling
- **OData-style filtering**: `$filter`, `$orderby`, pagination support
- **Generic fetchEntities function**: Works with any backend entity endpoint
- **Order-specific filtering**: Status, fitter, customer, seat size filters

### UI Framework
- **shadcn/ui components**: Complete component library in `components/ui/`
- **Radix UI primitives**: Accessible, unstyled components
- **Tailwind CSS 4.x**: Utility-first styling with CSS variables for theming
- **Lucide React**: Icon system throughout the application

### Data Management
- **@tanstack/react-table**: Complex table functionality with sorting/filtering
- **React Hook Form + Zod**: Form validation and management
- **Custom hooks**: `usePagination`, `useTableFilters`, `useEntities`

## File Structure Patterns

### App Router Structure
```
app/
├── layout.tsx                 # Root layout with ClientLayoutWrapper
├── page.tsx                   # Redirects to /dashboard
├── login/                     # Authentication pages
├── dashboard/                 # Main dashboard with metrics
├── orders/, customers/, etc.  # Entity management pages
└── saddle-modeling/          # Product configuration pages
```

### Component Organization
```
components/
├── ui/                       # shadcn/ui components (40+ components)
├── shared/                   # Reusable business components
│   ├── EntityTable.tsx       # Generic table component
│   └── TableHeaderFilter.tsx # Filtering system
└── [Entity].tsx             # Page-specific components
```

## Development Workflow

### Testing Strategy
- **Jest configuration**: `jest.config.js` with path mapping for `@/` imports
- **React Testing Library**: Component testing with jsdom environment
- **Coverage reporting**: HTML and LCOV formats, flexible thresholds
- **Test file patterns**: `__tests__/` directories or `.test.ts` suffixes

### Code Conventions
- **TypeScript strict mode**: Full type safety with proper interfaces
- **Path aliases**: Use `@/components`, `@/services`, etc. for imports
- **Component patterns**: Follow existing EntityTable and shared component patterns
- **API patterns**: Use centralized `fetchEntities` function for new endpoints

### Legacy Migration Context
- **Gradual migration**: From Aurelia.js frontend to Next.js
- **Coexistence period**: Some features may reference legacy system patterns
- **Database compatibility**: Shared database with legacy system during transition

## Entity Types & Relationships

### Core Entities
- **Orders**: Central entity with customer, fitter, and product relationships
- **Customers**: End users who place orders
- **Fitters**: Professionals who measure and fit saddles
- **Products**: Saddle models with configurable options

### Product Configuration System
- **Brands**: Saddle manufacturers
- **Models**: Specific saddle designs per brand
- **Leathertypes**: Material options
- **Options/Extras**: Configurable product features
- **Presets**: Saved configuration templates

## Common Development Tasks

### Adding New Entity Management
1. Create page component following existing patterns (e.g., `components/Orders.tsx`)
2. Define entity interface in `types/` directory
3. Add API service functions in `services/` 
4. Configure EntityTable with appropriate columns and filters
5. Add navigation route in sidebar component

### Extending Filtering System
- Add filter type to `TableHeaderFilter.tsx`
- Update `buildFilterString` functions in services
- Test with existing EntityTable implementations

### API Integration
- Use `fetchEntities` function for standard CRUD operations
- Follow OData filtering patterns for complex queries
- Implement proper error handling and loading states

## Deployment & Infrastructure

### Kubernetes Deployment Architecture
This application is deployed using Kubernetes with both staging and production environments on DigitalOcean infrastructure.

### Helm Charts
- **Location**: `../api/helm/api/`
- **Chart.yaml**: API Platform-based chart with PostgreSQL and Mercure dependencies
- **values.yaml**: Default configuration for PHP, Nginx, Varnish, PostgreSQL, and Mercure
- **Templates**: Complete Kubernetes resource templates (deployments, services, ingress, configmaps, secrets)

### Environment-Specific Configurations

#### Staging Environment
- **Namespace**: `oms-staging`
- **Domains**: 
  - `staging.ordermysaddle.com` (UI)
  - `staging-api.ordermysaddle.com` (API)
  - `staging.orderaviarsaddle.com` (Alternative domain)
- **Docker images**: `ordermysaddle/omsnext:*-staging`
- **Email testing**: Mailcatcher for development email testing
- **Kubernetes manifests**: `../kube/staging/`

#### Production Environment
- **Namespace**: `oms-production`
- **Domains**:
  - `production.ordermysaddle.com` (UI)
  - `production-api.ordermysaddle.com` (API)
  - `production.orderaviarsaddle.com` (Alternative domain)
- **Docker images**: `ordermysaddle/omsnext:*-production`
- **Email service**: Mailgun for production emails
- **Kubernetes manifests**: `../kube/production/`

### Deployment Components
Each environment includes:
- **API deployment**: Nginx + PHP-FPM containers
- **UI deployment**: Next.js frontend (this repository)
- **Cache proxy**: Varnish for API caching
- **Message consumer**: Background job processing
- **AMQP**: RabbitMQ for message queuing
- **Redis**: Session and cache storage
- **PostgreSQL**: Database (managed service)

### CI/CD Pipeline
- **Jenkins**: `https://cicd.ordermysaddle.com/blue/pipelines/`
- **Automated deployment**: Triggers on `staging` and `production` branch pushes
- **Testing**: UI and backend tests run before deployment
- **Manual approval**: Required for production deployments
- **Docker registry**: Docker Hub (`ordermysaddle/omsnext`)

### Deployment Commands

#### Helm Deployment
```bash
# Deploy to staging
helm upgrade --install oms-staging ../api/helm/api/ -f values-staging.yaml -n oms-staging

# Deploy to production
helm upgrade --install oms-production ../api/helm/api/ -f values-production.yaml -n oms-production
```

#### Manual Kubernetes Deployment
```bash
# Deploy staging environment
kubectl apply -f ../kube/staging/ -n oms-staging

# Deploy production environment
kubectl apply -f ../kube/production/ -n oms-production
```

### Security & Certificates
- **SSL certificates**: Let's Encrypt via cert-manager
- **Secrets management**: Kubernetes secrets for environment variables
- **Network policies**: CORS and trusted proxy configurations
- **Image security**: Docker images scanned and built via CI/CD

### Infrastructure Setup
- **Cloud provider**: DigitalOcean Kubernetes
- **Cluster setup**: `../kube/_manual/install.sh` for initial cluster configuration
- **Database**: Managed PostgreSQL service
- **Load balancers**: DigitalOcean load balancers for ingress

### API PHP backend Login
**Authentication**
```bash
curl -X POST "http://localhost:8888/login" -H "Content-Type: application/x-www-form-urlencoded" -d "username=$TEST_ADMIN_USER&password=$TEST_ADMIN_PASS" -v
```
Set `TEST_ADMIN_USER` and `TEST_ADMIN_PASS` from your `.env` file.