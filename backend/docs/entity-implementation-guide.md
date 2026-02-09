# Entity Implementation Guide

## Overview

Step-by-step guide for implementing new entities in the OMS NestJS backend. This guide ensures consistency with existing patterns and comprehensive implementation.

## Entity Implementation Pattern

### Standard Entity Structure
```
backend/[entity]/
├── domain/
│   ├── [entity].ts                    # Domain model
│   └── [entity].repository.ts         # Repository interface
├── infrastructure/
│   ├── persistence/
│   │   ├── relational/
│   │   │   ├── entities/[entity].entity.ts        # TypeORM entity
│   │   │   ├── repositories/[entity].repository.impl.ts  # Repository implementation
│   │   │   └── mappers/[entity].mapper.ts         # DTO mapping
├── [entity].service.ts                # Business logic
├── [entity].controller.ts             # REST endpoints
├── dto/
│   ├── create-[entity].dto.ts         # Creation validation
│   ├── update-[entity].dto.ts         # Update validation
│   └── query-[entity].dto.ts          # Query parameters
├── [entity].module.ts                 # NestJS module
└── __tests__/                        # Test files
    ├── [entity].service.spec.ts
    ├── [entity].controller.spec.ts
    └── [entity].e2e.spec.ts
```

## Required Components

Each entity module must include:
1. Domain model: `domain/[entity].ts`
2. TypeORM entity: `infrastructure/persistence/relational/entities/[entity].entity.ts`
3. Repository interface: `domain/[entity].repository.ts`
4. Repository implementation: `infrastructure/persistence/relational/repositories/[entity].repository.impl.ts`
5. Service: `[entity].service.ts`
6. Controller: `[entity].controller.ts` with `@UseGuards(AuthGuard("jwt"))`
7. DTOs: create, update, query DTOs
8. Mapper: `infrastructure/persistence/relational/mappers/[entity].mapper.ts`
9. Module: `[entity].module.ts`
10. Tests: Comprehensive test coverage (>90%)

## Entity Implementation Checklist

### Before Implementation
- [ ] Review existing customer/order modules for patterns
- [ ] Understand entity relationships and dependencies
- [ ] Plan implementation order (dependencies first)
- [ ] Prepare test data and scenarios

### During Implementation
- [ ] Follow exact directory structure
- [ ] Use consistent naming conventions
- [ ] Implement proper TypeScript types
- [ ] Add comprehensive validation
- [ ] Enable authentication guards
- [ ] Write tests as you go

### After Implementation
- [ ] Run tests and verify coverage
- [ ] Test authentication with different roles
- [ ] Verify frontend connectivity
- [ ] Check performance and optimization
- [ ] Update API documentation
- [ ] Create/update migrations if needed

## Common Implementation Issues and Solutions

### Authentication Issues
```bash
# If authentication guards aren't working
1. Check JWT configuration in auth module
2. Verify guard imports in controllers
3. Test with valid JWT tokens
4. Check role-based access control
```

### Relationship Issues
```bash
# If entity relationships fail
1. Verify TypeORM entity decorators
2. Check foreign key constraints
3. Test cascade operations
4. Verify mapper transformations
```

### Testing Issues
```bash
# If tests fail
1. Check test database setup
2. Verify mock configurations
3. Test individual components first
4. Check async operations
```

### Performance Issues
```bash
# If queries are slow
1. Add database indexes
2. Optimize query patterns
3. Implement caching
4. Check N+1 query issues
```

## Integration with Existing System

### Update App Module
After implementing entities, update `backend/src/app.module.ts`:
```typescript
// Add new modules to imports array
imports: [
  // ... existing modules
  BrandsModule,
  ModelsModule,
  LeathertypesModule,
  OptionsModule,
  ExtrasModule,
  PresetsModule,
  ProductsModule,
]
```

### Update Database Migrations
```bash
# Generate migrations for new entities
cd backend && npm run migration:generate -- CreateProductEntities
cd backend && npm run migration:run
```

### Update Seeds
```bash
# Add seed data for new entities
cd backend && npm run seed:run:relational
```

## Quick Reference Commands

```bash
# Generate a new entity module
npm run generate:resource:relational

# Check implementation progress
cd backend && npm run test && npm run lint

# Test specific entity
cd backend && npm run test [entity-name]

# Start backend to test
cd backend && npm run start:dev
```