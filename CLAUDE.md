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

### API & Environments

Two API endpoint versions in use:
- `apiUrlV2` — Azure Function App (authenticated via JWT interceptor)
- `apiUrlV3` — separate Azure endpoint (dev only; routed via `proxy.conf.json` as `/api`)

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

### Styling

SCSS throughout. Bootstrap 5 + Angular Material 15 for UI. Global styles in `src/styles.scss` and `src/scss/`. Component styles use `.scss` files co-located with each component.

### Deployment

Azure Static Web Apps via GitHub Actions. Config files: `staticwebapp.config.json`, `routes.json`. Build output: `dist/embutidos-any`.