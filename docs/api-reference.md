# API Reference

Comprehensive documentation for the Order Management System REST API. All endpoints are verified against the actual codebase controllers.

## Base Information

### API Base URL
- **Development**: `http://localhost:3001`
- **Staging**: `https://api-nest-staging.ordermysaddle.com`
- **Production**: `https://api-nest-production.ordermysaddle.com`

### API Version
- **Current Version**: `v1`
- **API Versioning**: URI-based (`/api/v1/`)
- **Non-versioned endpoints**: `/api/health`, `/api/admin/cache`, `/api/metrics`

### Content Type
- **Request**: `application/json`
- **Response**: `application/json`
- **File Upload**: `multipart/form-data`

---

## Authentication

### JWT Bearer Token

All protected endpoints require a JWT token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

### Login

**POST** `/api/v1/auth/email/login`

The `email` field accepts either a username or email address.

**Request Body:**
```json
{
  "email": "tester",
  "password": "string"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | string | Yes | Accepts username or email; auto-lowercased |
| `password` | string | Yes | |

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenExpires": 1700000000000,
  "user": {
    "id": 1,
    "username": "tester",
    "email": "adam@example.com",
    "name": "Adam Tester",
    "enabled": true,
    "currency": "GBP",
    "userType": 2,
    "isSupervisor": 0,
    "typeName": "admin",
    "lastLogin": "2024-01-15T10:00:00.000Z"
  }
}
```

### Register

**POST** `/api/v1/auth/email/register` — `204 No Content`

```json
{
  "email": "test@example.com",
  "password": "secret123",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Confirm Email

**POST** `/api/v1/auth/email/confirm` — `204 No Content`

```json
{ "hash": "<confirmation_hash>" }
```

### Confirm New Email

**POST** `/api/v1/auth/email/confirm/new` — `204 No Content`

```json
{ "hash": "<confirmation_hash>" }
```

### Forgot Password

**POST** `/api/v1/auth/forgot/password` — `204 No Content`

```json
{ "email": "test@example.com" }
```

### Reset Password

**POST** `/api/v1/auth/reset/password` — `204 No Content`

```json
{
  "password": "newPassword123",
  "hash": "<reset_hash>"
}
```

### Get Current User

**GET** `/api/v1/auth/me` — `200 OK`

Requires: JWT auth. Returns the authenticated user with serialization group `"me"`.

### Update Profile

**PATCH** `/api/v1/auth/me` — `200 OK`

Requires: JWT auth.

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "new.email@example.com",
  "password": "newPassword123",
  "oldPassword": "currentPassword"
}
```

All fields are optional. Changing the email triggers a confirmation flow. Changing the password requires `oldPassword`.

### Refresh Token

**POST** `/api/v1/auth/refresh` — `200 OK`

Requires: JWT-Refresh guard (send the refresh token).

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenExpires": 1700000000000
}
```

### Logout

**POST** `/api/v1/auth/logout` — `204 No Content`

Requires: JWT auth.

### Delete Account

**DELETE** `/api/v1/auth/me` — `204 No Content`

Requires: JWT auth.

---

## Response Formats

The API uses four distinct response patterns depending on the endpoint:

### Pattern A — Paginated (Customers, Fitters, Factories, Orders)

```json
{
  "data": [...],
  "total": 150,
  "pages": 8
}
```

### Pattern B — Order Search

```json
{
  "orders": [...],
  "total": 250,
  "page": 1,
  "limit": 20,
  "hasNext": true,
  "hasPrev": false
}
```

### Pattern C — Hydra JSON-LD (Enriched Orders, Saddle Stock)

```json
{
  "@context": "/api/contexts/EnrichedOrder",
  "@id": "/api/enriched_orders",
  "@type": "hydra:Collection",
  "hydra:member": [...],
  "hydra:totalItems": 150,
  "hydra:view": {
    "@id": "/api/enriched_orders?page=1",
    "@type": "hydra:PartialCollectionView",
    "hydra:first": "/api/enriched_orders?page=1",
    "hydra:last": "/api/enriched_orders?page=8",
    "hydra:next": "/api/enriched_orders?page=2"
  }
}
```

### Pattern D — Direct

Single entities return `T`, lists return `T[]` directly (e.g., active endpoints, urgent/overdue orders).

---

## Error Responses

Errors follow the standard NestJS `HttpException` format:

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "error": "Unprocessable Entity"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Successful GET, PATCH |
| 201 | Successful POST (resource created) |
| 202 | Accepted (async operations like cache warmup) |
| 204 | No Content (successful DELETE, auth actions) |
| 400 | Bad Request — invalid parameters |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — insufficient role |
| 404 | Not Found — resource does not exist |
| 422 | Unprocessable Entity — validation errors |
| 500 | Internal Server Error |
| 503 | Service Unavailable (health check failures) |

---

## Orders API

All endpoints require JWT auth. Route prefix: `/api/v1/orders`

### List Orders

**GET** `/api/v1/orders`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 10) |
| `fitterId` | number | Filter by fitter |
| `customerId` | number | Filter by customer |
| `factoryId` | number | Filter by factory |
| `status` | string | Filter by status |

**Response:** Pattern A — `{ data: OrderDto[], total, pages }`

### Get Order by ID

**GET** `/api/v1/orders/:id`

### Create Order

**POST** `/api/v1/orders` — `201 Created`

Decorated with `@AuditLog` (entity: "Order", action: "create_order").

### Update Order

**PATCH** `/api/v1/orders/:id`

Decorated with `@AuditLog` (trackStatusChange: true).

### Delete Order

**DELETE** `/api/v1/orders/:id`

### Cancel Order

**PATCH** `/api/v1/orders/:id/cancel`

**Request Body:**
```json
{ "reason": "Customer requested cancellation" }
```

### Advanced Search

**GET** `/api/v1/orders/search`

Optimized for production scale (<100ms response for 2.9M records).

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `customer` | string | Customer name (partial match, 2-100 chars) |
| `orderId` | integer | Exact order ID match |
| `orderNumber` | string | Exact order number |
| `seatSizeId` | string | Seat size filter |
| `isUrgent` | boolean | Urgency flag |
| `saddleId` | UUID | Saddle type/model |
| `fitterId` | UUID | Assigned fitter |
| `factoryId` | UUID | Assigned factory |
| `customerId` | UUID | Customer ID |
| `status` | string | `pending`, `confirmed`, `in_production`, `completed`, `cancelled`, `on_hold` |
| `priority` | string | `low`, `normal`, `high`, `urgent` |
| `dateFrom` | ISO 8601 | Date range start |
| `dateTo` | ISO 8601 | Date range end |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 20, max: 100) |
| `sortBy` | string | `createdAt`, `updatedAt`, `orderNumber`, `totalAmount`, `estimatedDeliveryDate`, `customerName` |
| `sortOrder` | string | `ASC` or `DESC` (default: DESC) |

**Response:** Pattern B — `{ orders, total, page, limit, hasNext, hasPrev }`

### Search Suggestions

**GET** `/api/v1/orders/search/suggestions`

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `customer` or `orderNumber` |
| `query` | string | Yes | Partial term (min 2 chars) |
| `limit` | number | No | Max suggestions (default: 10) |

**Response:** `{ suggestions: string[] }`

### Search Statistics

**GET** `/api/v1/orders/search/stats`

Same query parameters as search. Returns:

```json
{
  "totalMatching": 150,
  "urgentCount": 12,
  "statusBreakdown": { "pending": 25, "in_production": 80, "completed": 45 },
  "averageValue": 2500.00
}
```

### Special Order Lists

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/api/v1/orders/urgent` | GET | Urgent orders | `OrderDto[]` |
| `/api/v1/orders/overdue` | GET | Overdue orders | `OrderDto[]` |
| `/api/v1/orders/production` | GET | In-production orders | `OrderDto[]` |
| `/api/v1/orders/production/schedule` | GET | Production schedule (accepts `limit` query) | `OrderDto[]` |
| `/api/v1/orders/requiring-deposit` | GET | Orders requiring deposit | `OrderDto[]` |
| `/api/v1/orders/stats` | GET | Overall order statistics | Object |

### Orders by Relationship

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/orders/customer/:customerId` | GET | Orders for a customer |
| `/api/v1/orders/customer/:customerId/summary` | GET | Customer order summary |
| `/api/v1/orders/fitter/:fitterId` | GET | Orders for a fitter |
| `/api/v1/orders/factory/:factoryId` | GET | Orders for a factory |
| `/api/v1/orders/number/:orderNumber` | GET | Order by order number |

---

## Customers API

All endpoints require JWT auth. Route prefix: `/api/v1/customers`

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/api/v1/customers` | POST | Create customer | `201` (`@AuditLog`) |
| `/api/v1/customers` | GET | List customers (paginated) | Pattern A |
| `/api/v1/customers/:id` | GET | Get customer by ID | Single entity |
| `/api/v1/customers/:id` | PATCH | Update customer | (`@AuditLog`) |
| `/api/v1/customers/:id` | DELETE | Delete customer | (`@AuditLog`) |
| `/api/v1/customers/without-fitter` | GET | Customers with no fitter assigned | Array |
| `/api/v1/customers/fitter/:fitterId` | GET | Customers by fitter | Array |
| `/api/v1/customers/:customerId/assign-fitter/:fitterId` | POST | Assign fitter to customer | (`@AuditLog`) |

**List Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Items per page |
| `search` | string | Text search |
| `id` | number | Filter by ID |
| `name` | string | Filter by name |
| `email` | string | Filter by email |
| `city` | string | Filter by city |
| `country` | string | Filter by country |
| `fitterId` | number | Filter by fitter |

---

## Fitters API

All endpoints require JWT auth. Route prefix: `/api/v1/fitters`

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/api/v1/fitters` | POST | Create fitter | `201` (`@AuditLog`) |
| `/api/v1/fitters` | GET | List fitters (paginated) | Pattern A |
| `/api/v1/fitters/active` | GET | Active fitters | Array |
| `/api/v1/fitters/:id` | GET | Get fitter by ID | Single entity |
| `/api/v1/fitters/:id` | PATCH | Update fitter | (`@AuditLog`) |
| `/api/v1/fitters/:id` | DELETE | Delete fitter | (`@AuditLog`) |
| `/api/v1/fitters/country/:country` | GET | Fitters by country | Array |
| `/api/v1/fitters/city/:city` | GET | Fitters by city | Array |
| `/api/v1/fitters/stats/country/:country/count` | GET | Count fitters in country | `{ count }` |
| `/api/v1/fitters/stats/active/count` | GET | Count active fitters | `{ count }` |

**List Query Parameters:** `page`, `limit`, `city`, `country`

---

## Factories API

All endpoints require JWT auth. Route prefix: `/api/v1/factories`

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/api/v1/factories` | POST | Create factory | `201` (`@AuditLog`) |
| `/api/v1/factories` | GET | List factories (paginated) | Pattern A |
| `/api/v1/factories/active` | GET | Active factories | Array |
| `/api/v1/factories/:id` | GET | Get factory by ID | Single entity |
| `/api/v1/factories/:id` | PATCH | Update factory | (`@AuditLog`) |
| `/api/v1/factories/:id` | DELETE | Delete factory | (`@AuditLog`) |
| `/api/v1/factories/country/:country` | GET | Factories by country | Array |
| `/api/v1/factories/city/:city` | GET | Factories by city | Array |
| `/api/v1/factories/stats/country/:country/count` | GET | Count factories in country | `{ count }` |
| `/api/v1/factories/stats/active/count` | GET | Count active factories | `{ count }` |

**List Query Parameters:** `page`, `limit`, `city`, `country`

---

## Factory Employees API

All endpoints require JWT auth. Route prefix: `/api/v1/factory-employees`

| Endpoint | Method | Description | HTTP Code |
|----------|--------|-------------|-----------|
| `/api/v1/factory-employees` | POST | Create employee | 201 |
| `/api/v1/factory-employees` | GET | List employees | 200 |
| `/api/v1/factory-employees/:id` | GET | Get employee by ID | 200 |
| `/api/v1/factory-employees/:id` | PATCH | Update employee | 200 |
| `/api/v1/factory-employees/:id` | DELETE | Delete employee | 204 |
| `/api/v1/factory-employees/factory/:factoryId` | GET | Employees by factory | 200 |
| `/api/v1/factory-employees/factory/:factoryId/count` | GET | Employee count for factory | 200 |
| `/api/v1/factory-employees/bulk-transfer` | POST | Bulk transfer employees | 200 |

**List Query Parameters:** `factoryId`, `name`, `limit`, `offset`, `page`

**Bulk Transfer Body:**
```json
{
  "employeeIds": [1, 2, 3],
  "newFactoryId": 5
}
```

---

## Saddles API

All endpoints require JWT auth. Route prefix: `/api/v1/saddles`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/saddles` | POST | Create saddle |
| `/api/v1/saddles` | GET | List saddles (paginated) |
| `/api/v1/saddles/active` | GET | Active saddles |
| `/api/v1/saddles/brands` | GET | Unique brand names |
| `/api/v1/saddles/next-sequence` | GET | Next sequence number |
| `/api/v1/saddles/brand/:brand` | GET | Saddles by brand |
| `/api/v1/saddles/type/:type` | GET | Saddles by type |
| `/api/v1/saddles/:id` | GET | Get saddle by ID |
| `/api/v1/saddles/:id` | PATCH | Update saddle |
| `/api/v1/saddles/:id` | DELETE | Delete saddle |

**List Query Parameters:** `page`, `limit`, `id`, `brand`, `modelName`, `sequence`, `type`, `search`, `activeOnly`, `active`

---

## Brands API

All endpoints require JWT auth. Route prefix: `/api/v1/brands`

| Endpoint | Method | Description | HTTP Code |
|----------|--------|-------------|-----------|
| `/api/v1/brands` | POST | Create brand | 201 |
| `/api/v1/brands` | GET | List brands (paginated) | 200 |
| `/api/v1/brands/active` | GET | Active brands | 200 |
| `/api/v1/brands/:id` | GET | Get brand by ID | 200 |
| `/api/v1/brands/:id` | PATCH | Update brand | 200 |
| `/api/v1/brands/:id` | DELETE | Delete brand | 204 |

**List Query Parameters:** `page`, `limit`, `search`

---

## Leathertypes API

All endpoints require JWT auth. Route prefix: `/api/v1/leathertypes`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/leathertypes` | POST | Create leathertype |
| `/api/v1/leathertypes` | GET | List leathertypes (paginated) |
| `/api/v1/leathertypes/active` | GET | Active leathertypes |
| `/api/v1/leathertypes/:id` | GET | Get leathertype by ID |
| `/api/v1/leathertypes/:id` | PATCH | Update leathertype |
| `/api/v1/leathertypes/:id` | DELETE | Delete leathertype |

**List Query Parameters:** `page`, `limit`, `search`

---

## Options API

All endpoints require JWT auth. Route prefix: `/api/v1/options`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/options` | POST | Create option |
| `/api/v1/options` | GET | List options (paginated) |
| `/api/v1/options/active` | GET | Active options |
| `/api/v1/options/group/:group` | GET | Options by group |
| `/api/v1/options/type/:type` | GET | Options by type |
| `/api/v1/options/:id` | GET | Get option by ID |
| `/api/v1/options/:id` | PATCH | Update option |
| `/api/v1/options/:id` | DELETE | Delete option |

**List Query Parameters:** `page`, `limit`, `search`, `group`, `type`

---

## Option Items API

All endpoints require JWT auth. Route prefix: `/api/v1/option-items`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/option-items` | POST | Create option item |
| `/api/v1/option-items` | GET | List option items (paginated) |
| `/api/v1/option-items/active` | GET | Active option items |
| `/api/v1/option-items/option/:optionId` | GET | Items by option |
| `/api/v1/option-items/:id` | GET | Get item by ID |
| `/api/v1/option-items/:id` | PATCH | Update item |
| `/api/v1/option-items/:id` | DELETE | Delete item |

**List Query Parameters:** `page`, `limit`, `optionId`, `leatherId`, `search`

---

## Extras API

All endpoints require JWT auth. Route prefix: `/api/v1/extras`. **Uses UUID IDs.**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/extras` | POST | Create extra (`@AuditLog`) |
| `/api/v1/extras` | GET | List extras (paginated) |
| `/api/v1/extras/active` | GET | Active extras |
| `/api/v1/extras/:id` | GET | Get extra by UUID |
| `/api/v1/extras/:id` | PATCH | Update extra (`@AuditLog`) |
| `/api/v1/extras/:id` | DELETE | Delete extra (`@AuditLog`) |

**List Query Parameters:** `page`, `limit`, `search`

---

## Presets API

All endpoints require JWT auth. Route prefix: `/api/v1/presets`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/presets` | POST | Create preset (`@AuditLog`) |
| `/api/v1/presets` | GET | List presets (paginated) |
| `/api/v1/presets/:id` | GET | Get preset by ID |
| `/api/v1/presets/:id` | PATCH | Update preset (`@AuditLog`) |
| `/api/v1/presets/:id` | DELETE | Delete preset (`@AuditLog`) |

**List Query Parameters:** `page`, `limit`, `search`

---

## Order Lines API

All endpoints require JWT auth. Route prefix: `/api/v1/order-lines`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/order-lines` | POST | Create order line |
| `/api/v1/order-lines/bulk` | POST | Bulk create order lines |
| `/api/v1/order-lines` | GET | List order lines |
| `/api/v1/order-lines/order/:orderId` | GET | Lines by order |
| `/api/v1/order-lines/order/:orderId/total` | GET | Calculate order total |
| `/api/v1/order-lines/order/:orderId/resequence` | POST | Resequence lines |
| `/api/v1/order-lines/product/:productId` | GET | Lines by product |
| `/api/v1/order-lines/:id` | GET | Get line by ID |
| `/api/v1/order-lines/:id` | PATCH | Update line |
| `/api/v1/order-lines/:id` | DELETE | Delete line |

**Resequence Body:**
```json
{ "lineIds": [3, 1, 2] }
```

---

## Order-Product-Saddles API

All endpoints require JWT auth. Route prefix: `/api/v1/order_product_saddles`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/order_product_saddles` | POST | Create relationship |
| `/api/v1/order_product_saddles` | GET | List relationships |
| `/api/v1/order_product_saddles/order/:orderId` | GET | By order |
| `/api/v1/order_product_saddles/order/:orderId/count` | GET | Count for order |
| `/api/v1/order_product_saddles/product/:productId` | GET | By product |
| `/api/v1/order_product_saddles/:id` | GET | Get by ID |
| `/api/v1/order_product_saddles/:id` | PATCH | Update |
| `/api/v1/order_product_saddles/:id` | DELETE | Delete |
| `/api/v1/order_product_saddles/bulk` | POST | Bulk create |

---

## Saddle Leathers API

All endpoints require JWT auth. Route prefix: `/api/v1/saddle-leathers`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/saddle-leathers` | POST | Create association |
| `/api/v1/saddle-leathers` | GET | List associations |
| `/api/v1/saddle-leathers/saddle/:saddleId` | GET | By saddle |
| `/api/v1/saddle-leathers/leather/:leatherId` | GET | By leather |
| `/api/v1/saddle-leathers/:id` | GET | Get by ID |
| `/api/v1/saddle-leathers/:id` | PATCH | Update |
| `/api/v1/saddle-leathers/:id` | DELETE | Delete |

**List Query Parameters:** `page`, `limit`, `saddleId`, `leatherId`

---

## Saddle Options Items API

All endpoints require JWT auth. Route prefix: `/api/v1/saddle-options-items`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/saddle-options-items` | POST | Create association |
| `/api/v1/saddle-options-items` | GET | List associations |
| `/api/v1/saddle-options-items/saddle/:saddleId` | GET | By saddle |
| `/api/v1/saddle-options-items/option/:optionId` | GET | By option |
| `/api/v1/saddle-options-items/saddle/:saddleId/option/:optionId` | GET | By saddle + option combo |
| `/api/v1/saddle-options-items/:id` | GET | Get by ID |
| `/api/v1/saddle-options-items/:id` | PATCH | Update |
| `/api/v1/saddle-options-items/:id` | DELETE | Delete |

**List Query Parameters:** `page`, `limit`, `saddleId`, `optionId`

---

## Saddle Extras API

All endpoints require JWT auth. Route prefix: `/api/v1/saddle-extras`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/saddle-extras` | POST | Create association |
| `/api/v1/saddle-extras` | GET | List associations |
| `/api/v1/saddle-extras/saddle/:saddleId` | GET | By saddle |
| `/api/v1/saddle-extras/:id` | GET | Get by ID |
| `/api/v1/saddle-extras/:id` | PATCH | Update |
| `/api/v1/saddle-extras/:id` | DELETE | Delete |

**List Query Parameters:** `page`, `limit`, `saddleId`, `extraId`

---

## Enriched Orders API

All endpoints require JWT auth. Route prefix: `/api/v1/enriched_orders`

Uses materialized views (`enriched_order_view`, `order_edit_view`) with Redis caching.

### List Enriched Orders

**GET** `/api/v1/enriched_orders`

Returns Hydra JSON-LD collection (Pattern C).

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Items per page |
| `partial` | boolean | Partial loading |
| `searchTerm` / `search` | string | Text search |
| `orderBy` | string | Sort field |
| `orderDirection` | string | Sort direction |
| `id` / `orderId` | number | Filter by order ID |
| `urgency` / `urgent` | boolean | Filter by urgency |
| `fitterId` / `fitterName` / `fitter` | string/number | Filter by fitter |
| `customerId` / `customerName` / `customer` | string/number | Filter by customer |
| `brandId` | number | Filter by brand |
| `orderStatus` / `status` | string | Filter by status |
| `factoryId` / `factoryName` / `factory` | string/number | Filter by factory |
| `seatSizes` / `seatSize` | string | Filter by seat size |
| `customerCountry` | string | Filter by customer country |
| `repair` | boolean | Filter repairs |

### Other Enriched Order Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/enriched_orders/edit-options` | GET | Form configuration for editing |
| `/api/v1/enriched_orders/detail/:id` | GET | Full order detail with specs, comments, logs |
| `/api/v1/enriched_orders/update-status/:id` | PATCH | Update order status |
| `/api/v1/enriched_orders/health` | GET | Service health status |

---

## Saddle Stock API

All endpoints require JWT auth. Route prefix: `/api/v1/saddle-stock`

**GET** `/api/v1/saddle-stock`

Returns Hydra JSON-LD collection (Pattern C).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `my`, `available`, or `all` |
| `page` | number | No | Page number |
| `limit` | number | No | Items per page |
| `search` | string | No | Text search |

**Role restrictions:**
- `my` and `available`: FITTER role only
- `all`: ADMIN or SUPERVISOR only

---

## Comments API

All endpoints require JWT auth. Route prefix: `/api/v1/comments`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/comments` | POST | Create comment |
| `/api/v1/comments` | GET | List comments |
| `/api/v1/comments/:id` | GET | Get comment by ID |
| `/api/v1/comments/:id` | PATCH | Update comment |
| `/api/v1/comments/:id` | DELETE | Delete comment |
| `/api/v1/comments/order/:orderId` | GET | Comments by order |
| `/api/v1/comments/order/:orderId/public` | GET | Public comments for order |
| `/api/v1/comments/order/:orderId/internal` | GET | Internal comments for order |
| `/api/v1/comments/order/:orderId/stats` | GET | Comment statistics for order |
| `/api/v1/comments/user/:userId` | GET | Comments by user |

---

## Users API

All endpoints require JWT auth + **ADMIN or SUPERVISOR role**. Route prefix: `/api/v1/users`

All responses use `@SerializeOptions({ groups: ["admin"] })`.

| Endpoint | Method | Description | HTTP Code |
|----------|--------|-------------|-----------|
| `/api/v1/users` | POST | Create user (`@AuditLog`) | 201 |
| `/api/v1/users` | GET | List users (paginated with filters/sort) | 200 |
| `/api/v1/users/:id` | GET | Get user by ID | 200 |
| `/api/v1/users/:id` | PATCH | Update user (`@AuditLog`) | 200 |
| `/api/v1/users/:id` | DELETE | Delete user (`@AuditLog`) | 204 |

---

## Audit Logs API

All endpoints require JWT auth. Route prefix: `/api/v1/audit-logs`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/audit-logs` | POST | Create audit log |
| `/api/v1/audit-logs` | GET | List audit logs (searchable, 764K+ records) |
| `/api/v1/audit-logs/:id` | GET | Get audit log by ID |
| `/api/v1/audit-logs/statistics` | GET | Dashboard metrics (`fromDate`, `toDate` query params) |
| `/api/v1/audit-logs/orders/:orderId/trail` | GET | Order audit trail (`page`, `limit`) |
| `/api/v1/audit-logs/users/:userId/trail` | GET | User audit trail (`page`, `limit`) |
| `/api/v1/audit-logs/status-changes` | GET | Status change history (`orderId`, `fromStatus`, `toStatus`, `page`, `limit`) |
| `/api/v1/audit-logs/bulk` | POST | Bulk create (for migration) |
| `/api/v1/audit-logs/log-action` | POST | Log a system action (`userId`, `action`, `orderId`) |
| `/api/v1/audit-logs/archive` | POST | Archive old logs (`beforeDate` in body) |

---

## Database Query Logs API

All endpoints require JWT auth. Route prefix: `/api/v1/database-query-logs`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/database-query-logs` | POST | Create query log |
| `/api/v1/database-query-logs` | GET | List query logs (74K+ records) |
| `/api/v1/database-query-logs/:id` | GET | Get query log by ID |
| `/api/v1/database-query-logs/statistics` | GET | Query performance stats (`fromDate`, `toDate`) |
| `/api/v1/database-query-logs/analysis` | GET | Query pattern analysis (`fromDate`, `toDate`) |
| `/api/v1/database-query-logs/slow-queries` | GET | Slow queries (`page`, `limit`) |
| `/api/v1/database-query-logs/users/:userId/queries` | GET | Queries by user |
| `/api/v1/database-query-logs/pages/:page/queries` | GET | Queries by page |
| `/api/v1/database-query-logs/bulk` | POST | Bulk create (for migration) |
| `/api/v1/database-query-logs/log-query` | POST | Log a query (`query`, `userId`, `page`, `backtrace`) |

---

## Health API

No authentication required. Route prefix: `/api/health`

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/api/health` | GET | General health (DB, Redis, Memory 150MB, Disk 90%) | 200 / 503 |
| `/api/health/ready` | GET | Readiness probe (DB only) | 200 / 503 |
| `/api/health/live` | GET | Liveness probe (Memory 200MB, Disk 95%) | 200 / 503 |
| `/api/health/detailed` | GET | Full report with metadata, version, environment | 200 |

**Response (general):**
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "memory_heap": { "status": "up" },
    "disk": { "status": "up" }
  }
}
```

---

## Cache Management API

Requires JWT auth + **ADMIN or SUPERVISOR role**. Route prefix: `/api/admin/cache`

| Endpoint | Method | Description | HTTP Code |
|----------|--------|-------------|-----------|
| `/api/admin/cache/stats` | GET | Cache performance metrics | 200 |
| `/api/admin/cache/health` | GET | Cache system status | 200 |
| `/api/admin/cache/metrics` | GET | Detailed metrics | 200 |
| `/api/admin/cache/metrics/endpoints` | GET | Per-endpoint analytics | 200 |
| `/api/admin/cache/performance-report` | GET | Performance report with recommendations | 200 |
| `/api/admin/cache/warmup/status` | GET | Current warming state | 200 |
| `/api/admin/cache/warmup` | POST | Start background cache warming | 202 |
| `/api/admin/cache/warmup/:dataType` | POST | Warm specific data type | 202 |
| `/api/admin/cache/clear` | DELETE | Flush all cache data | 200 |
| `/api/admin/cache/invalidate/:pattern` | DELETE | Invalidate by pattern | 200 |
| `/api/admin/cache/invalidate/tag/:tag` | DELETE | Invalidate by tag | 200 |
| `/api/admin/cache/invalidate/entity` | POST | Invalidate entity cache (`entityType`, `entityId`, `operation`) | 200 |
| `/api/admin/cache/invalidation/stats` | GET | Invalidation queue status | 200 |
| `/api/admin/cache/test/load` | POST | Run load test (`requests` query, default 1000) | 200 |
| `/api/admin/cache/metrics/reset` | POST | Reset metric counters | 200 |
| `/api/admin/cache/config` | GET | Current cache configuration | 200 |

---

## Metrics API

No authentication required. Route prefix: `/api/metrics`

**GET** `/api/metrics`

Returns Prometheus-format metrics. `Content-Type: text/plain`

---

## Access Filter Groups API

All endpoints require JWT auth. Route prefix: `/api/v1/access-filter-groups`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/access-filter-groups` | POST | Create filter group |
| `/api/v1/access-filter-groups` | GET | List filter groups |
| `/api/v1/access-filter-groups/:id` | GET | Get group by ID |
| `/api/v1/access-filter-groups/:id` | PATCH | Update group |
| `/api/v1/access-filter-groups/:id` | DELETE | Delete group |
| `/api/v1/access-filter-groups/stats/count` | GET | Count active groups |
| `/api/v1/access-filter-groups/:id/restore` | POST | Restore deleted group |

---

## Country Managers API

All endpoints require JWT auth. Route prefix: `/api/v1/country_managers`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/country_managers` | POST | Create country manager |
| `/api/v1/country_managers` | GET | List country managers |
| `/api/v1/country_managers/active` | GET | Active managers |
| `/api/v1/country_managers/statistics/overview` | GET | Manager statistics |
| `/api/v1/country_managers/country/:country` | GET | Managers by country |
| `/api/v1/country_managers/region/:region` | GET | Managers by region |
| `/api/v1/country_managers/:id` | GET | Get manager by ID |
| `/api/v1/country_managers/:id` | PATCH | Update manager |
| `/api/v1/country_managers/:id` | DELETE | Delete manager |

---

## Warehouses API

All endpoints require JWT auth. Route prefix: `/api/v1/warehouses`. **Uses UUID IDs.**

| Endpoint | Method | Description | HTTP Code |
|----------|--------|-------------|-----------|
| `/api/v1/warehouses` | POST | Create warehouse | 201 |
| `/api/v1/warehouses` | GET | List warehouses | 200 |
| `/api/v1/warehouses/:id` | GET | Get warehouse by UUID | 200 |
| `/api/v1/warehouses/:id` | PATCH | Update warehouse | 200 |
| `/api/v1/warehouses/:id` | DELETE | Soft delete warehouse | 200 |
| `/api/v1/warehouses/:id/restore` | POST | Restore deleted warehouse | 200 |

---

## Files API

Requires JWT auth for upload. Route prefix: `/api/v1/files`

| Endpoint | Method | Description | HTTP Code |
|----------|--------|-------------|-----------|
| `/api/v1/files/upload` | POST | Upload file (`multipart/form-data`) | 201 |
| `/api/v1/files/:path` | GET | Download file (no auth required) | 200 |

---

## Utility Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/` | GET | No | Application info |
| `/docs` | GET | No | Interactive Swagger UI |
| `/docs/json` | GET | No | OpenAPI schema (JSON) |

---

## Testing the API

### Using cURL

```bash
# Login (use seeded test users — see Getting Started for full list)
curl -X POST http://localhost:3001/api/v1/auth/email/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@omsaddle.com", "password": "AdminPass123!"}'

# List orders (with token)
curl http://localhost:3001/api/v1/orders?page=1&limit=20 \
  -H "Authorization: Bearer <your_token>"

# Search orders
curl "http://localhost:3001/api/v1/orders/search?customer=John&status=pending&limit=10" \
  -H "Authorization: Bearer <your_token>"

# Get enriched orders (Hydra format)
curl "http://localhost:3001/api/v1/enriched_orders?page=1&limit=30" \
  -H "Authorization: Bearer <your_token>"

# Health check
curl http://localhost:3001/api/health
```

### Using JavaScript/Fetch

```javascript
// Login (use seeded test users — see Getting Started for full list)
const loginResponse = await fetch('http://localhost:3001/api/v1/auth/email/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@omsaddle.com', password: 'AdminPass123!' })
});

const { token, refreshToken, tokenExpires, user } = await loginResponse.json();

// Use token for requests
const ordersResponse = await fetch('http://localhost:3001/api/v1/orders?page=1&limit=20', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { data, total, pages } = await ordersResponse.json();
```

---

## Best Practices

### API Usage Guidelines

1. **Always use HTTPS in production**
2. **Include proper error handling** for `statusCode` / `message` / `error` responses
3. **Implement request timeouts**
4. **Use appropriate HTTP methods** (GET for reads, POST for creates, PATCH for updates, DELETE for removals)

### Performance Tips

1. **Use pagination** — all list endpoints support `page` and `limit`
2. **Use the search endpoint** for orders instead of client-side filtering
3. **Leverage Hydra pagination** (`hydra:next`/`hydra:previous`) for enriched orders
4. **Use Redis caching** — enriched orders and saddle stock are cached (5-minute TTL)
5. **Batch operations** — use bulk endpoints where available (order lines, order-product-saddles, audit logs)

### Security Recommendations

1. **Store tokens securely** (httpOnly cookies or secure storage)
2. **Use the refresh token flow** to renew access tokens
3. **Validate all input** — the API uses class-validator for DTO validation
4. **Role-based access** — admin/cache and users endpoints require ADMIN or SUPERVISOR roles
5. **HTTPS only** in staging and production environments

---

## Related Documentation

- **[Architecture](./architecture.md)** — System architecture overview
- **[Development Workflow](./development-workflow.md)** — Development guidelines
- **Swagger UI** — Interactive API docs at `http://localhost:3001/docs`
