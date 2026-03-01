# Order Management System - Next.js Frontend

This is a [Next.js](https://nextjs.org) project for managing saddle manufacturing orders with comprehensive role-based access control.

## Features

- **Role-Based Authentication**: 5 user roles (USER, FITTER, SUPPLIER, ADMIN, SUPERVISOR)
- **Account Management**: SUPERVISOR-only user and warehouse management
- **Order Management**: Complete order lifecycle with status tracking
- **Product Configuration**: Saddle modeling with brands, models, options, and presets
- **Responsive UI**: Built with shadcn/ui and Tailwind CSS

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Backend API running on `http://localhost:8888` (configurable)

### Development Setup

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd next-ui
npm install
```

2. **Start the development server:**
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

3. **Open the application:**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Ensure backend API is running on [http://localhost:8888](http://localhost:8888)

4. **Environment Configuration:**
   - Backend URL: `NEXT_PUBLIC_API_URL=http://localhost:8888` (default)
   - Check `CLAUDE.md` for detailed environment setup

## Testing

The application includes a comprehensive test suite covering role-based authentication, permissions, and UI components.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test categories
npm test __tests__/permissions/     # Permission logic tests
npm test __tests__/components/      # Component tests  
npm test __tests__/services/        # API service tests
npm test __tests__/integration/     # Integration tests
```

### Test Categories

#### 1. **Permission Tests** (`__tests__/permissions/`)
Tests for role-based access control and permission validation:
```bash
npm test __tests__/permissions/rolePermissions.test.ts
npm test __tests__/permissions/accountManagementPermissions.test.ts
```

**Coverage:**
- Role hierarchy validation (USER → FITTER → SUPPLIER → ADMIN → SUPERVISOR)
- Screen access permissions
- Action permissions (create, edit, delete)
- Account Management exclusive permissions (SUPERVISOR-only)

#### 2. **Service Tests** (`__tests__/services/`)
Tests for API service layer and data management:
```bash
npm test __tests__/services/users.test.ts
npm test __tests__/services/warehouses.test.ts
```

**Coverage:**
- CRUD operations for user and warehouse management
- API request validation
- Error handling and status management
- Filtering and sorting functionality

#### 3. **Component Tests** (`__tests__/components/`)
Tests for UI components and role-based rendering:
```bash
npm test __tests__/components/role-access/
npm test __tests__/components/shared/
```

**Coverage:**
- Role-based navigation filtering
- Account Management sidebar section
- User permissions matrix display
- Shared components (EntityTable, StatusBadge, filters)

#### 4. **Route Protection Tests** (`__tests__/pages/`)
Tests for page-level access control:
```bash
npm test __tests__/pages/route-protection/
```

**Coverage:**
- SUPERVISOR-only route access (`/users`, `/warehouses`, `/user-permissions`)
- Unauthorized access handling
- Route middleware validation

#### 5. **Integration Tests** (`__tests__/integration/`)
End-to-end workflow tests:
```bash
npm test __tests__/integration/UserJourney.test.tsx
```

**Coverage:**
- Complete user journey flows for each role
- Navigation structure changes
- Permission escalation scenarios
- Cross-component interactions

### Test User Credentials

Test credentials are stored in environment variables. See `.env.example` for the required format.

### Role Permission Matrix

| Feature | USER | FITTER | SUPPLIER | ADMIN | SUPERVISOR |
|---------|------|--------|----------|-------|------------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Orders | ✅ | ✅ | ❌ | ✅ | ✅ |
| Customers | ❌ | ✅ | ❌ | ✅ | ✅ |
| Fitters | ❌ | ❌ | ❌ | ✅ | ✅ |
| Reports | ❌ | ❌ | ❌ | ✅ | ✅ |
| Suppliers | ❌ | ❌ | ✅* | ✅* | ✅* |
| **Account Management** | ❌ | ❌ | ❌ | ❌ | ✅ |
| User Management | ❌ | ❌ | ❌ | ❌ | ✅ |
| Warehouse Management | ❌ | ❌ | ❌ | ❌ | ✅ |
| User Permissions View | ❌ | ❌ | ❌ | ❌ | ✅ |

*Suppliers now accessed through Account Management section

### Test Configuration

Tests are configured with Jest and React Testing Library:
- **Coverage thresholds**: Flexible with focus on critical paths
- **Path mapping**: Uses `@/` aliases matching the application
- **Mock providers**: Authentication and permission contexts
- **Test utilities**: Role helpers and permission matrices

### Debugging Tests

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file with watch mode
npm test -- --watch __tests__/permissions/rolePermissions.test.ts

# Debug test with Node.js inspector
npm test -- --runInBand --no-cache --watchAll=false
```

## User Roles & Access Levels

### Role Hierarchy (lowest to highest privilege)

1. **USER** - Basic order creation and saddle modeling
2. **FITTER** - Customer management + USER permissions  
3. **SUPPLIER** - Supplier management access only
4. **ADMIN** - Full system access except Account Management
5. **SUPERVISOR** - Complete system access including Account Management

### Account Management (SUPERVISOR Only)

- **User Management**: Create, edit, delete system users
- **Warehouse Management**: Manage warehouse locations and inventory
- **User Permissions**: View and manage role assignments
- **Suppliers**: Moved from main navigation to Account Management

## Architecture

- **Frontend**: Next.js 15 with App Router
- **UI**: shadcn/ui components with Tailwind CSS
- **State**: Jotai for global state management
- **Authentication**: JWT tokens with role-based permissions
- **Backend**: PHP/Symfony API (separate repository)

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm start           # Start production server
npm run lint        # ESLint code checking
npm test            # Run test suite
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - Next.js features and API
- [shadcn/ui](https://ui.shadcn.com/) - UI component library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [React Testing Library](https://testing-library.com/react) - Testing utilities

## Deployment

The application is deployed using Kubernetes with staging and production environments. See `CLAUDE.md` for detailed deployment instructions and CI/CD pipeline configuration.
