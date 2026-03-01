# Saved Report Filters — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users save, load, and manage named report filter presets with an optional default that auto-loads.

**Architecture:** New `report-saved-filters` NestJS module (entity, repository, service, controller) following the hexagonal pattern used by `access-filter-groups`. Frontend gets a new service file and UI additions to `Reports.tsx` (a saved-filter bar above the filter panel, plus save/manage dialogs).

**Tech Stack:** TypeORM entity + migration (PostgreSQL), NestJS controller with JWT guards, React state + shadcn Dialog/Popover/Button on the frontend.

**Design doc:** `docs/plans/2026-03-01-saved-report-filters-design.md`

---

## Task 1: Database Migration

**Files:**
- Create: `backend/src/database/migrations/1771000000000-CreateReportSavedFiltersTable.ts`

**Step 1: Create the migration file**

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateReportSavedFiltersTable1771000000000 implements MigrationInterface {
  name = "CreateReportSavedFiltersTable1771000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_saved_filters" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "filters" JSONB NOT NULL DEFAULT '{}',
        "is_default" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_report_saved_filters_user_name" UNIQUE ("user_id", "name")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_report_saved_filters_user_id" ON "report_saved_filters" ("user_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_report_saved_filters_is_default" ON "report_saved_filters" ("is_default")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_saved_filters"`);
  }
}
```

**Step 2: Run migration**

Run: `cd backend && npm run migration:run`
Expected: Migration applies successfully, table created.

**Step 3: Commit**

```
feat: add report_saved_filters migration
```

---

## Task 2: Backend Entity + Repository

**Files:**
- Create: `backend/src/report-saved-filters/infrastructure/persistence/relational/entities/report-saved-filter.entity.ts`
- Create: `backend/src/report-saved-filters/infrastructure/persistence/relational/repositories/report-saved-filter.repository.ts`
- Create: `backend/src/report-saved-filters/infrastructure/persistence/relational/relational-persistence.module.ts`

**Step 1: Create the entity**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("report_saved_filters")
@Index("idx_report_saved_filters_user_id", ["userId"])
@Index("idx_report_saved_filters_is_default", ["isDefault"])
export class ReportSavedFilterEntity {
  @PrimaryGeneratedColumn("increment")
  id: number;

  @Column({ name: "user_id", type: "integer", nullable: false })
  userId: number;

  @Column({ name: "name", type: "varchar", length: 255, nullable: false })
  name: string;

  @Column({
    name: "filters",
    type: "jsonb",
    nullable: false,
    default: "'{}'",
  })
  filters: Record<string, unknown>;

  @Column({
    name: "is_default",
    type: "boolean",
    default: false,
    nullable: false,
  })
  isDefault: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date;
}
```

**Step 2: Create the repository**

```typescript
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReportSavedFilterEntity } from "../entities/report-saved-filter.entity";

@Injectable()
export class ReportSavedFilterRepository {
  constructor(
    @InjectRepository(ReportSavedFilterEntity)
    private readonly repository: Repository<ReportSavedFilterEntity>,
  ) {}

  async create(data: Partial<ReportSavedFilterEntity>): Promise<ReportSavedFilterEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findAllByUser(userId: number): Promise<ReportSavedFilterEntity[]> {
    return this.repository.find({
      where: { userId },
      order: { name: "ASC" },
    });
  }

  async findById(id: number): Promise<ReportSavedFilterEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findDefault(userId: number): Promise<ReportSavedFilterEntity | null> {
    return this.repository.findOne({
      where: { userId, isDefault: true },
    });
  }

  async clearDefaults(userId: number): Promise<void> {
    await this.repository.update({ userId, isDefault: true }, { isDefault: false });
  }

  async update(id: number, data: Partial<ReportSavedFilterEntity>): Promise<ReportSavedFilterEntity | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
```

**Step 3: Create the persistence module**

```typescript
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReportSavedFilterEntity } from "./entities/report-saved-filter.entity";
import { ReportSavedFilterRepository } from "./repositories/report-saved-filter.repository";

@Module({
  imports: [TypeOrmModule.forFeature([ReportSavedFilterEntity])],
  providers: [ReportSavedFilterRepository],
  exports: [ReportSavedFilterRepository],
})
export class ReportSavedFilterRelationalPersistenceModule {}
```

**Step 4: Commit**

```
feat: add ReportSavedFilter entity and repository
```

---

## Task 3: Backend DTOs

**Files:**
- Create: `backend/src/report-saved-filters/dto/create-report-saved-filter.dto.ts`
- Create: `backend/src/report-saved-filters/dto/update-report-saved-filter.dto.ts`

**Step 1: Create DTO**

```typescript
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsObject, Length } from "class-validator";

export class CreateReportSavedFilterDto {
  @ApiProperty({ description: "Filter preset name", example: "Q1 European Fitters", maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;

  @ApiProperty({ description: "Filter configuration JSON", example: { fitters: ["John"], statuses: ["In Production"] } })
  @IsObject()
  @IsNotEmpty()
  filters: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Set as default filter", default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
```

**Step 2: Update DTO**

```typescript
import { PartialType } from "@nestjs/swagger";
import { CreateReportSavedFilterDto } from "./create-report-saved-filter.dto";

export class UpdateReportSavedFilterDto extends PartialType(CreateReportSavedFilterDto) {}
```

**Step 3: Commit**

```
feat: add report saved filter DTOs
```

---

## Task 4: Backend Service

**Files:**
- Create: `backend/src/report-saved-filters/report-saved-filter.service.ts`

**Step 1: Create service**

```typescript
import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { ReportSavedFilterRepository } from "./infrastructure/persistence/relational/repositories/report-saved-filter.repository";
import { CreateReportSavedFilterDto } from "./dto/create-report-saved-filter.dto";
import { UpdateReportSavedFilterDto } from "./dto/update-report-saved-filter.dto";
import { ReportSavedFilterEntity } from "./infrastructure/persistence/relational/entities/report-saved-filter.entity";

@Injectable()
export class ReportSavedFilterService {
  constructor(private readonly repository: ReportSavedFilterRepository) {}

  async create(userId: number, dto: CreateReportSavedFilterDto): Promise<ReportSavedFilterEntity> {
    if (dto.isDefault) {
      await this.repository.clearDefaults(userId);
    }
    return this.repository.create({
      userId,
      name: dto.name,
      filters: dto.filters,
      isDefault: dto.isDefault ?? false,
    });
  }

  async findAll(userId: number): Promise<ReportSavedFilterEntity[]> {
    return this.repository.findAllByUser(userId);
  }

  async findDefault(userId: number): Promise<ReportSavedFilterEntity | null> {
    return this.repository.findDefault(userId);
  }

  async update(id: number, userId: number, dto: UpdateReportSavedFilterDto): Promise<ReportSavedFilterEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Saved filter with ID "${id}" not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException("Cannot modify another user's saved filter");
    }

    if (dto.isDefault) {
      await this.repository.clearDefaults(userId);
    }

    const data: Partial<ReportSavedFilterEntity> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.filters !== undefined) data.filters = dto.filters;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;

    const updated = await this.repository.update(id, data);
    if (!updated) {
      throw new NotFoundException(`Failed to update saved filter with ID "${id}"`);
    }
    return updated;
  }

  async remove(id: number, userId: number): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Saved filter with ID "${id}" not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException("Cannot delete another user's saved filter");
    }
    await this.repository.delete(id);
  }
}
```

**Step 2: Commit**

```
feat: add ReportSavedFilter service with user-scoped CRUD
```

---

## Task 5: Backend Controller + Module Registration

**Files:**
- Create: `backend/src/report-saved-filters/report-saved-filter.controller.ts`
- Create: `backend/src/report-saved-filters/report-saved-filter.module.ts`
- Modify: `backend/src/app.module.ts` (add import)

**Step 1: Create controller**

```typescript
import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, HttpCode, HttpStatus, ParseIntPipe, Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { ReportSavedFilterService } from "./report-saved-filter.service";
import { CreateReportSavedFilterDto } from "./dto/create-report-saved-filter.dto";
import { UpdateReportSavedFilterDto } from "./dto/update-report-saved-filter.dto";

@ApiTags("Report Saved Filters")
@Controller({ path: "report-saved-filters", version: "1" })
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.fitter)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class ReportSavedFilterController {
  constructor(private readonly service: ReportSavedFilterService) {}

  private getUserId(req: { user?: { legacyId?: number } }): number {
    const id = req.user?.legacyId;
    if (!id) throw new Error("User legacyId not found in JWT payload");
    return id;
  }

  @Post()
  @ApiOperation({ summary: "Create a saved report filter" })
  @ApiResponse({ status: 201, description: "Saved filter created" })
  async create(
    @Req() req: { user?: { legacyId?: number } },
    @Body() dto: CreateReportSavedFilterDto,
  ) {
    return this.service.create(this.getUserId(req), dto);
  }

  @Get()
  @ApiOperation({ summary: "List all saved report filters for current user" })
  @ApiResponse({ status: 200, description: "List of saved filters" })
  async findAll(@Req() req: { user?: { legacyId?: number } }) {
    return this.service.findAll(this.getUserId(req));
  }

  @Get("default")
  @ApiOperation({ summary: "Get the default saved filter for current user" })
  @ApiResponse({ status: 200, description: "Default filter or null" })
  async findDefault(@Req() req: { user?: { legacyId?: number } }) {
    return this.service.findDefault(this.getUserId(req));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a saved report filter" })
  @ApiResponse({ status: 200, description: "Updated saved filter" })
  async update(
    @Req() req: { user?: { legacyId?: number } },
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateReportSavedFilterDto,
  ) {
    return this.service.update(id, this.getUserId(req), dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a saved report filter" })
  @ApiResponse({ status: 204, description: "Deleted" })
  async remove(
    @Req() req: { user?: { legacyId?: number } },
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.remove(id, this.getUserId(req));
  }
}
```

**Step 2: Create module**

```typescript
import { Module } from "@nestjs/common";
import { ReportSavedFilterService } from "./report-saved-filter.service";
import { ReportSavedFilterController } from "./report-saved-filter.controller";
import { ReportSavedFilterRelationalPersistenceModule } from "./infrastructure/persistence/relational/relational-persistence.module";

@Module({
  imports: [ReportSavedFilterRelationalPersistenceModule],
  controllers: [ReportSavedFilterController],
  providers: [ReportSavedFilterService],
  exports: [ReportSavedFilterService],
})
export class ReportSavedFilterModule {}
```

**Step 3: Register in app.module.ts**

Add to imports array in `backend/src/app.module.ts`:

```typescript
import { ReportSavedFilterModule } from "./report-saved-filters/report-saved-filter.module";

// In @Module({ imports: [...] })
ReportSavedFilterModule, // Report saved filters
```

**Step 4: Verify backend compiles**

Run: `cd backend && npm run build`
Expected: Compiles without errors.

**Step 5: Commit**

```
feat: add report-saved-filters controller, module, app registration
```

---

## Task 6: Frontend Service

**Files:**
- Create: `frontend/services/reportSavedFilters.ts`

**Step 1: Create the service**

```typescript
import { API_URL, fetchWithRefresh } from './api-config';

export interface SavedFilter {
  id: number;
  userId: number;
  name: string;
  filters: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getSavedFilters(): Promise<SavedFilter[]> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/report-saved-filters`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to fetch saved filters: ${response.status}`);
  return response.json();
}

export async function getDefaultFilter(): Promise<SavedFilter | null> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/report-saved-filters/default`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch default filter: ${response.status}`);
  const data = await response.json();
  return data || null;
}

export async function createSavedFilter(data: {
  name: string;
  filters: Record<string, unknown>;
  isDefault?: boolean;
}): Promise<SavedFilter> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/report-saved-filters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Failed to create saved filter: ${response.status}`);
  }
  return response.json();
}

export async function updateSavedFilter(
  id: number,
  data: { name?: string; filters?: Record<string, unknown>; isDefault?: boolean },
): Promise<SavedFilter> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/report-saved-filters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update saved filter: ${response.status}`);
  }
  return response.json();
}

export async function deleteSavedFilter(id: number): Promise<void> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/report-saved-filters/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to delete saved filter: ${response.status}`);
}
```

**Step 2: Commit**

```
feat: add frontend reportSavedFilters service
```

---

## Task 7: Frontend — Saved Filter Bar + Save Dialog in Reports.tsx

**Files:**
- Modify: `frontend/components/Reports.tsx`

This is the main UI task. It adds:
1. State for saved filters list, the active saved filter, and dialog open/close
2. A `serializeFilters()` helper that captures current filter state to JSON
3. An `applyFilterState()` helper that restores all filter fields from JSON
4. Auto-load of default filter on mount
5. A saved-filter bar between the title and the filter panel
6. A save dialog (name input + default checkbox)
7. A manage dialog (list with rename/delete/set-default)

**Step 1: Add imports at top of Reports.tsx**

Add after existing imports:

```typescript
import { getSavedFilters, getDefaultFilter, createSavedFilter, updateSavedFilter, deleteSavedFilter } from '../services/reportSavedFilters';
import type { SavedFilter } from '../services/reportSavedFilters';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Star, Trash2 } from 'lucide-react';
```

Note: `Dialog` is already imported — merge with existing import or use a rename if there's a conflict. The existing `Dialog` import can be replaced since it's the same component.

**Step 2: Add state variables after existing state declarations (around line 60)**

```typescript
// Saved filters state
const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
const [activeSavedFilterId, setActiveSavedFilterId] = useState<number | null>(null);
const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
const [saveFilterName, setSaveFilterName] = useState('');
const [saveFilterDefault, setSaveFilterDefault] = useState(false);
const [saveError, setSaveError] = useState('');
```

**Step 3: Add serialize/apply helpers (before the return statement)**

```typescript
const serializeFilters = useCallback((): Record<string, unknown> => {
  return {
    fitters: selectedFitters,
    statuses: selectedStatuses,
    saleTypes: selectedSaleTypes,
    customers: selectedCustomers,
    factories: selectedFactories,
    saddles: selectedSaddles,
    customerCountries: selectedCustomerCountries,
    fitterCountries: selectedFitterCountries,
    seatSizes: selectedSeatSizes,
    kneeRolls: selectedKneeRolls,
    leatherTypes: selectedLeatherTypes,
    urgent: selectedUrgent,
    orderedDate: {
      from: orderedDate.from?.toISOString() ?? null,
      to: orderedDate.to?.toISOString() ?? null,
    },
    date: {
      from: date.from?.toISOString() ?? null,
      to: date.to?.toISOString() ?? null,
    },
    paymentDate: {
      from: paymentDate.from?.toISOString() ?? null,
      to: paymentDate.to?.toISOString() ?? null,
    },
    groupBySaddle,
  };
}, [
  selectedFitters, selectedStatuses, selectedSaleTypes, selectedCustomers,
  selectedFactories, selectedSaddles, selectedCustomerCountries, selectedFitterCountries,
  selectedSeatSizes, selectedKneeRolls, selectedLeatherTypes, selectedUrgent,
  orderedDate, date, paymentDate, groupBySaddle,
]);

const applyFilterState = useCallback((f: Record<string, unknown>) => {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v : []);
  const parseDate = (v: unknown): Date | undefined => (typeof v === 'string' ? new Date(v) : undefined);

  setSelectedFitters(arr(f.fitters));
  setSelectedStatuses(arr(f.statuses));
  setSelectedSaleTypes(arr(f.saleTypes));
  setSelectedCustomers(arr(f.customers));
  setSelectedFactories(arr(f.factories));
  setSelectedSaddles(arr(f.saddles));
  setSelectedCustomerCountries(arr(f.customerCountries));
  setSelectedFitterCountries(arr(f.fitterCountries));
  setSelectedSeatSizes(arr(f.seatSizes));
  setSelectedKneeRolls(arr(f.kneeRolls));
  setSelectedLeatherTypes(arr(f.leatherTypes));
  setSelectedUrgent(typeof f.urgent === 'string' ? f.urgent : 'all');
  setGroupBySaddle(f.groupBySaddle === true);

  const dateObj = f.orderedDate as { from?: string | null; to?: string | null } | undefined;
  setOrderedDate({ from: parseDate(dateObj?.from), to: parseDate(dateObj?.to) });
  const dObj = f.date as { from?: string | null; to?: string | null } | undefined;
  setDate({ from: parseDate(dObj?.from), to: parseDate(dObj?.to) });
  const pObj = f.paymentDate as { from?: string | null; to?: string | null } | undefined;
  setPaymentDate({ from: parseDate(pObj?.from), to: parseDate(pObj?.to) });

  // Rebuild headerFilters from multi-select arrays
  const newHeaderFilters: Record<string, string> = {};
  if (arr(f.fitters).length) newHeaderFilters.fitter = arr(f.fitters).join(',');
  if (arr(f.statuses).length) newHeaderFilters.status = arr(f.statuses).join(',');
  if (arr(f.saleTypes).length) newHeaderFilters.saleType = arr(f.saleTypes).join(',');
  if (arr(f.customers).length) newHeaderFilters.customer = arr(f.customers).join(',');
  if (arr(f.factories).length) newHeaderFilters.supplier = arr(f.factories).join(',');
  if (arr(f.saddles).length) newHeaderFilters.saddle = arr(f.saddles).join(',');
  if (arr(f.customerCountries).length) newHeaderFilters.customerCountry = arr(f.customerCountries).join(',');
  if (arr(f.fitterCountries).length) newHeaderFilters.fitterCountry = arr(f.fitterCountries).join(',');
  if (arr(f.seatSizes).length) newHeaderFilters.seatSize = arr(f.seatSizes).join(',');
  if (arr(f.kneeRolls).length) newHeaderFilters.kneeRoll = arr(f.kneeRolls).join(',');
  if (arr(f.leatherTypes).length) newHeaderFilters.leatherType = arr(f.leatherTypes).join(',');
  const urgent = typeof f.urgent === 'string' ? f.urgent : 'all';
  if (urgent !== 'all') newHeaderFilters.urgent = urgent === 'urgent' ? 'true' : 'false';
  setHeaderFilters(newHeaderFilters);
  setPage(1);
}, []);
```

**Step 4: Add load-saved-filters and auto-load-default effects**

```typescript
// Load saved filters list
const refreshSavedFilters = useCallback(() => {
  getSavedFilters().then(setSavedFilters).catch(() => {});
}, []);

useEffect(() => { refreshSavedFilters(); }, [refreshSavedFilters]);

// Auto-load default filter on mount
const [defaultLoaded, setDefaultLoaded] = useState(false);
useEffect(() => {
  if (defaultLoaded) return;
  getDefaultFilter().then(df => {
    if (df) {
      applyFilterState(df.filters);
      setActiveSavedFilterId(df.id);
    }
    setDefaultLoaded(true);
  }).catch(() => setDefaultLoaded(true));
}, [defaultLoaded, applyFilterState]);
```

**Step 5: Add save handler**

```typescript
const handleSaveFilter = async () => {
  if (!saveFilterName.trim()) {
    setSaveError('Name is required');
    return;
  }
  setSaveError('');
  try {
    const created = await createSavedFilter({
      name: saveFilterName.trim(),
      filters: serializeFilters(),
      isDefault: saveFilterDefault,
    });
    setIsSaveDialogOpen(false);
    setSaveFilterName('');
    setSaveFilterDefault(false);
    setActiveSavedFilterId(created.id);
    refreshSavedFilters();
  } catch (e: unknown) {
    setSaveError(e instanceof Error ? e.message : 'Failed to save');
  }
};
```

**Step 6: Add the saved-filter bar JSX**

Insert between the `<h2>` title and the filter panel `<div className="bg-gray-100 ...">`:

```tsx
{/* Saved filters bar */}
<div className="flex items-center gap-3 mb-4">
  <Select
    value={activeSavedFilterId ? String(activeSavedFilterId) : "none"}
    onValueChange={(val) => {
      if (val === "none") return;
      const sf = savedFilters.find(f => f.id === Number(val));
      if (sf) {
        applyFilterState(sf.filters);
        setActiveSavedFilterId(sf.id);
      }
    }}
  >
    <SelectTrigger className="w-[250px]">
      <SelectValue placeholder="Load saved filter..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">Load saved filter...</SelectItem>
      {savedFilters.map(sf => (
        <SelectItem key={sf.id} value={String(sf.id)}>
          {sf.isDefault ? '\u2605 ' : ''}{sf.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  <Button variant="outline" onClick={() => {
    setSaveFilterName('');
    setSaveFilterDefault(false);
    setSaveError('');
    setIsSaveDialogOpen(true);
  }}>
    Save current filters
  </Button>

  {savedFilters.length > 0 && (
    <Button variant="outline" onClick={() => setIsManageDialogOpen(true)}>
      Manage saved filters
    </Button>
  )}
</div>
```

**Step 7: Add the Save dialog JSX (before closing `</div>` of the component)**

```tsx
{/* Save filter dialog */}
<Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Save current filters</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <div>
        <label className="text-sm font-medium">Name</label>
        <Input
          value={saveFilterName}
          onChange={(e) => setSaveFilterName(e.target.value)}
          placeholder="e.g. Q1 European Orders"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFilter(); }}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="saveFilterDefault"
          checked={saveFilterDefault}
          onCheckedChange={(checked) => setSaveFilterDefault(checked as boolean)}
        />
        <label htmlFor="saveFilterDefault" className="text-sm">Set as default (auto-load on page open)</label>
      </div>
      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
      <Button onClick={handleSaveFilter}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 8: Add the Manage dialog JSX**

```tsx
{/* Manage saved filters dialog */}
<Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Manage saved filters</DialogTitle>
    </DialogHeader>
    <div className="space-y-2 py-2 max-h-[400px] overflow-y-auto">
      {savedFilters.map(sf => (
        <div key={sf.id} className="flex items-center gap-2 p-2 rounded border">
          <button
            type="button"
            title={sf.isDefault ? 'Default filter' : 'Set as default'}
            className="shrink-0"
            onClick={async () => {
              await updateSavedFilter(sf.id, { isDefault: !sf.isDefault });
              refreshSavedFilters();
            }}
          >
            <Star className={`h-4 w-4 ${sf.isDefault ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
          </button>
          <span className="flex-1 text-sm truncate">{sf.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const sf2 = savedFilters.find(f => f.id === sf.id);
              if (sf2) {
                applyFilterState(sf2.filters);
                setActiveSavedFilterId(sf2.id);
                setIsManageDialogOpen(false);
              }
            }}
          >
            Load
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={async () => {
              await deleteSavedFilter(sf.id);
              if (activeSavedFilterId === sf.id) setActiveSavedFilterId(null);
              refreshSavedFilters();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {savedFilters.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No saved filters yet.</p>
      )}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsManageDialogOpen(false)}>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 9: Verify frontend compiles**

Run: `cd frontend && npm run build`
Expected: Compiles without errors.

**Step 10: Commit**

```
feat: add saved filter bar, save/manage dialogs to Reports page
```

---

## Task 8: Manual Smoke Test

**Step 1:** Start backend and frontend locally

Run: `cd backend && npm run start:dev` (one terminal)
Run: `cd frontend && npm run dev` (another terminal)

**Step 2:** Open http://localhost:3000/reports and log in.

**Step 3:** Test save flow:
- Set some filters (select a few fitters, a status, a date range)
- Click "Save current filters"
- Enter a name, check "Set as default", click Save
- Verify the saved filter appears in the dropdown

**Step 4:** Test load flow:
- Click "Reset All Filters" to clear
- Select the saved filter from the dropdown
- Verify all filters are restored

**Step 5:** Test default auto-load:
- Refresh the page
- Verify the default filter auto-loads

**Step 6:** Test manage flow:
- Click "Manage saved filters"
- Toggle the star icon to change default
- Delete a filter
- Verify changes are reflected

**Step 7: Commit (if any fixes needed)**

```
fix: address smoke test feedback for saved filters
```
