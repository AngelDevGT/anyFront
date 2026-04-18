# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development server (with API proxy to Azure backend)
npm start
# or
ng serve --proxy-config proxy.conf.json

# Production build
npm run build

# Run tests
npm test

# Run a single test file
ng test --include='**/path/to/component.spec.ts'
```

## Architecture Overview

This is an Angular 15 inventory/POS management system for a food processing company ("Embutidos Any"). It manages raw materials, finished products, store sales, and cash flow across factory and store locations.

### Layout & Routing

Two top-level layouts with lazy-loaded feature modules:
- `AdminLayoutModule` — all authenticated pages (60+ routes), protected by `canActivateV2` guard
- `AccountModule` — login/register (unauthenticated)

The default route (`''`) loads `AdminLayoutModule`. All admin routes are defined in `src/app/layouts/admin-layout/admin-layout.routing.ts`.

### Authentication

- JWT-based auth; token stored in the user object managed by `AccountService` via `BehaviorSubject<User>`
- Three route guards in `src/app/helpers/auth.guard.ts`: use `canActivateV2` for new routes — it validates the user's role-based `paths` array against the requested route using regex matching
- `JwtInterceptor` automatically attaches `Authorization: Bearer {token}` to all requests targeting `apiUrlV2`
- `ErrorInterceptor` handles global HTTP errors

### Services

- **`DataService`** (`src/app/services/data/data.service.ts`) — monolithic 47KB API gateway for all HTTP operations. All domain CRUD (providers, raw materials, products, inventory, orders, store sales, cash closing) lives here. Each domain has status ID constants defined within the service (e.g., `establishmentStatusValues`).
- **`AccountService`** (`src/app/services/account.service.ts`) — auth state, JWT handling, role-based menu config (60+ items), and path permission definitions.
- **`AlertService`** (`src/app/services/alert.service.ts`) — toast notifications via RxJS Subject. Use `alertService.success()`, `.error()`, `.info()`, `.warn()`.
- **`SessionService`** (`src/app/services/session/session.service.ts`) — legacy auth service, superseded by `AccountService`. Do not use for new code.
- **`HeadersService`** (`src/app/services/headers/headers.service.ts`) — legacy header helper, superseded by `JwtInterceptor`. Do not use for new code.

### API & Environments

Environment files live in `src/environments/enviroment.ts` and `enviroment.prod.ts` (note: intentional typo in filename — missing the 'n').

Two API endpoint versions in use:
- `apiUrlV2` — Azure Function App (authenticated via JWT interceptor)
- `apiUrlV3` — separate Azure endpoint. `proxy.conf.json` rewrites `/api` → `https://any-function-sql.azurewebsites.net/api/V3` for local dev; to use the proxy, set `apiUrlV3: '/api'` in `enviroment.ts` and run `ng serve --proxy-config proxy.conf.json`.

API responses follow the pattern: `response.data[0].json_result` or domain-specific wrappers like `retrieveEstablishmentsResponse?.data[0]?.json_result`.

### Shared Components (`src/app/components/`)

Reusable components registered in `ComponentsModule`:
- `ResponsiveTableComponent` — dynamic table with configurable columns and action buttons
- `DynamicDialogComponent` — reusable modal
- `ViewObjectComponent` — detail view for any object
- `AlertComponent` — renders toasts from `AlertService`
- `SidebarComponent` / `NavbarComponent` — layout chrome driven by `AccountService.menuItemsOptions`

### Feature Pages (`src/app/pages/`)

Organized by domain: `establishment/`, `providers/`, `raw-material-*/`, `finished-product/`, `product-for-sale/`, `inventory-*/`, `store-*/`, `cash-closing/`, `admin-summary/`, `activity-log/`. Each domain typically has `list-*`, `add-*`, and `view-*` components.

### Models (`src/app/models/`)

- `auxiliary/` — enums: `Role`, `Status`, `UnitType`, `PaymentStatus`
- `system/` — `User`, `Provider`, `ActivityLog`
- `raw-material/`, `product/`, `inventory/`, `store/` — domain-specific interfaces

### Database (`src/database/`)

The backend is a thin Azure Function App that delegates all business logic to a PostgreSQL database. When understanding or modifying data behavior, refer to these files first:

- **`definitions.sql`** — full table schema (PostgreSQL). Key tables:
  - `status` — shared status catalog; every domain entity references it by `status_id`. Status IDs are also hardcoded as constants in `DataService`.
  - `inventory` / `inventory_element` / `inventory_element_action` — generic inventory system. `inventory_type` and `unit_name` discriminate between factory raw material, bodega, and store inventories.
  - `action_type` — catalog of inventory movements (add, remove, transfer, etc.).
  - `product_for_sale` — links a `finished_product` to an `establishment` with a price.
  - `product_for_sale_store_order` / `product_for_sale_store_order_element` — store purchase orders from factory.
  - `shop_sale` / `shop_sale_element` — retail sales at the store.
  - `cash_closing` — stores snapshots of inventory and sales as `jsonb` columns for period closing.
  - `raw_material_order` / `raw_material_order_element` — purchase orders from providers.

- **`store_procedures.sql`** — PostgreSQL stored procedures that encapsulate all business logic (inventory normalization to base units, transfers between inventories, etc.). API endpoints call these procedures directly — there is no additional application-layer logic.

- **`data.sql`** — Seeds the `sql_queries` table, which is the core API routing mechanism. Each row maps an endpoint path to a raw SQL query or stored procedure call. The Azure Function backend receives a path, looks up the matching row, and executes the SQL. **This file is the source of truth for all available API endpoints and their exact response shapes.** Key endpoints by domain:
  - Catalog: `/getStatus`, `/getMeasure`, `/getUnitBase`, `/getRoles`, `/getPaymentTypes`
  - Establishments: `/retrieveEstablishments`, `/getEstablishment`, `/addEstablishment`, `/updateEstablishment`, `/deleteEstablishment`
  - Users: `/retrieveUsers`, `/getUser`, `/registerUser`, `/createUser`, `/updateUser`, `/deleteUser`
  - Providers: `/retrieveProviders`, `/getProviderById`, `/addProvider`, `/updateProvider`, `/deleteProvider`
  - Raw materials: `/retrieveRawMaterial`, `/getRawMaterial`, `/addRawMaterial`, `/UpdateRawMaterial`, `/deleteRawMaterial`
  - Raw material by provider: `/retrieveRawMaterialByProvider`, `/getRawMaterialByProvider`, `/addRawMaterialByProvider`, `/updateRawMaterialByProvider`, `/deleteRawMaterialByProvider`
  - Raw material orders: `/listRawMaterialOrder`, `/getRawMaterialOrder`, `/retrieveRawMaterialOrder`, `/addRawMaterialOrder`, `/updateRawMaterialOrder`, `/updateRawMaterialOrderElements`, `/deleteRawMaterialOrder`, `/verifyRawMaterialOrder`, `/addRawMaterialOrderPaymentHistory`
  - Finished products: `/retrieveFinishedProduct`, `/getFinishedProduct`, `/addFinishedProduct`, `/updateFinishedProduct`, `/deleteFinishedProduct`
  - Products for sale: `/retrieveProductsForSale`, `/getProductForSale`, `/addProductForSale`, `/addManyProductForSale`, `/updateProductForSale`, `/deleteProductForSale`
  - Store orders (PFS): `/listProductForSaleStoreOrder`, `/getProductForSaleStoreOrder`, `/addProductForSaleStoreOrder`, `/updateProductForSaleStoreOrder`, `/updateProductForSaleStoreOrderEnCamino`, `/deleteProductForSaleStoreOrder`, `/manageProductForSaleStoreOrder`
  - Inventory: `/retrieveRawMaterialInventory`, `/retrieveFinishedProductInventory`, `/retrieveProductForSaleInventory`, `/addRemoveInventoryElement`, `/multiAddRemoveInventoryElement`
  - Activity logs: `/retriveRawMaterialInventoryActions`, `/retriveFinishedProductInventoryActions`, `/retriveProductForSaleInventoryActions`
  - Shop sales: `/listShopSale`, `/getShopSale`, `/registerShop`, `/UpdateShopHistory`, `/cancelShopHistory`
  - Cash closing: `/listStoreCashClosing`, `/retrieveStoreCashClosing`, `/getNewStoreCashClosing`, `/addStoreCashClosing`, `/updateStoreCashClosing`, `/verifyCashClosing`, `/deleteStoreCashClosing`

**Key design patterns:**
- All quantities are normalized to a base unit (`unit_base_quantity` in `measure`) before storage.
- `inventory_element.element_fk` is a polymorphic UUID that points to `raw_material` or `finished_product` depending on `element_type`.
- `cash_closing` denormalizes state into `jsonb` snapshots at close time.

### Styling

SCSS throughout. Bootstrap 5 + Angular Material 15 for UI. Global styles in `src/styles.scss` and `src/scss/`. Component styles use `.scss` files co-located with each component.

### Deployment

Azure Static Web Apps via GitHub Actions. Config files: `staticwebapp.config.json`, `routes.json`. Build output: `dist/embutidos-any`.