# Saved Report Filters — Design

## Overview

Add the ability for logged-in users to save, load, and manage report filter presets on the Reports page (`/reports`). Each user can save multiple named filter configurations and optionally set one as their default (auto-loaded on page open).

## Database

### Table: `report_saved_filters`

| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PRIMARY KEY |
| user_id | integer | NOT NULL |
| name | varchar(255) | NOT NULL |
| filters | jsonb | NOT NULL |
| is_default | boolean | DEFAULT false |
| created_at | timestamp | DEFAULT now() |
| updated_at | timestamp | DEFAULT now() |

- Unique constraint on `(user_id, name)` — no duplicate names per user
- Only one `is_default = true` per user (enforced in service logic, not DB constraint)
- No foreign key to `user` table (legacy integer IDs used, not UUIDs)

### Filter JSON shape

```json
{
  "fitters": ["John Doe"],
  "statuses": ["In Production"],
  "saleTypes": ["normal"],
  "customers": [],
  "factories": ["Factory A"],
  "saddles": [],
  "customerCountries": [],
  "fitterCountries": [],
  "seatSizes": ["17"],
  "kneeRolls": [],
  "leatherTypes": [],
  "urgent": "all",
  "orderedDate": { "from": "2025-01-01", "to": null },
  "date": { "from": null, "to": null },
  "paymentDate": { "from": null, "to": null },
  "groupBySaddle": false
}
```

## Backend: NestJS Module `report-saved-filters`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/report-saved-filters | Create saved filter |
| GET | /api/v1/report-saved-filters | List user's saved filters |
| GET | /api/v1/report-saved-filters/default | Get user's default filter (or 404) |
| PATCH | /api/v1/report-saved-filters/:id | Update name/filters/isDefault |
| DELETE | /api/v1/report-saved-filters/:id | Delete saved filter |

### Access control

- All endpoints require JWT auth (`AuthGuard("jwt")`)
- Roles: admin, supervisor, fitter
- All queries scoped to `request.user.legacyId` — users can only see/modify their own filters
- When setting `isDefault = true`, service clears `is_default` on all other filters for that user first

### DTOs

**CreateReportSavedFilterDto**: `{ name: string, filters: Record<string, any>, isDefault?: boolean }`
**UpdateReportSavedFilterDto**: `{ name?: string, filters?: Record<string, any>, isDefault?: boolean }`

### Entity

Standard TypeORM entity following project hexagonal patterns. Raw SQL approach (like enriched-orders) is unnecessary here — TypeORM repository is sufficient for simple CRUD.

## Frontend

### UI: Saved filter bar (above filter panel)

A compact horizontal bar between the page title and the gray filter panel:

```
[Order Reports                                          ]
[  Load: [▾ Select saved filter]  [Save]  [Manage]     ]
[  ┌─────────────────── Filter Panel ──────────────┐    ]
```

- **Load dropdown**: Lists saved filters by name. Selecting one populates all filter fields. Shows a star icon next to the default filter.
- **Save button**: Opens a small dialog with name input + "Set as default" checkbox. If filters match an existing saved filter, offers to update it.
- **Manage button**: Opens a dialog with a table of saved filters. Each row has: name (editable), default toggle (star), delete button.

### Auto-load default

On component mount, fetch `GET /api/v1/report-saved-filters/default`. If found, apply its filters to all state variables before the first data fetch.

### Frontend service

New file `frontend/services/reportSavedFilters.ts` with functions:
- `getSavedFilters(): Promise<SavedFilter[]>`
- `getDefaultFilter(): Promise<SavedFilter | null>`
- `createSavedFilter(data): Promise<SavedFilter>`
- `updateSavedFilter(id, data): Promise<SavedFilter>`
- `deleteSavedFilter(id): Promise<void>`

### Filter serialization

A helper function `serializeCurrentFilters()` collects all filter state into the JSON shape. A corresponding `applyFilterState(state)` restores all state variables from a saved filter's JSON.

## Non-goals

- No sharing filters between users (future enhancement)
- No server-side execution of saved filters (filters are applied client-side as today)
- No versioning of filter schemas
