# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Westpoint Pharmacy — a multi-branch pharmacy inventory, POS, and stock-transfer system. Laravel 11 + Inertia.js (v2) + React 18 (JSX, no TypeScript), Tailwind + shadcn/ui (`new-york`, components in `resources/js/components/ui`), MySQL. Runs locally under XAMPP on Windows. The README is stock Laravel boilerplate; `docs/QA-AUDIT-REPORT.md` is a detailed audit of inventory-correctness issues and explains much of the defensive design described below.

## Commands

```bash
composer dev                 # server + queue + pail logs + vite, all concurrently
npm run dev                  # vite only (use when Apache/XAMPP serves PHP)
npm run build                # production assets
npm run serve:ngrok          # build, then artisan serve behind an ngrok tunnel

php artisan migrate
php artisan db:seed --class=WestpointSeeder   # roles, branches, staff/admin/superadmin @westpoint.test users

php artisan test                                        # full suite
php artisan test --filter=PosSplitBatchSaleTest         # one class
php artisan test --filter=test_box_sale_spanning_two_batches_keeps_one_commercial_line

vendor/bin/pint              # PHP formatter (Laravel preset); no JS linter configured
php artisan inventory:expire-batches   # also scheduled daily at 00:15
```

Tests run against **MySQL**, not SQLite: `phpunit.xml` points at database `db_westpoint_testing`, which must exist locally. Feature tests use `RefreshDatabase` plus the `Tests\Support\SeedsWestpoint` trait (call `$this->seedWestpoint()` in `setUp`) for roles, two branches, one user per role, a product with `pack_size = 10`, and a batch.

## Architecture

### Roles and branch scoping
- Three roles by integer `role_id`: **1 = Staff, 2 = Admin, 3 = Superadmin**. Routes gate with the `role` middleware alias using these ids, e.g. `->middleware(['auth', 'role:2,3'])`.
- On login, `AuthenticatedSessionController` copies `role_id` and `branch_id` into the session. Controllers scope queries with `session('branch_id')` / `session('role_id')` (often through private `branchId()` / `roleId()` helpers), not `auth()->user()`. Admins/superadmins can see across branches in some screens.
- The sidebar (`resources/js/components/app-sidebar.jsx`) builds separate nav lists per role.

### Routing
`routes/web.php` only defines dashboards/profile and then `require`s one route file per module (`pos.php`, `stock-in.php`, `stock-out.php`, `stocktransfer.php`, `quotation.php`, `return.php`, `void.php`, `report.php`, ...). Add new module routes in their own file and require it there. Frontend uses Ziggy's `route()` helper.

`Table`, `Menu`, `Order`, `Product`, `Category` routes/controllers/pages are leftovers from an earlier restaurant-POS template and are not linked from the sidebar. The live pharmacy domain is `MedicineProduct` + `ProductQty` (batches).

### Inventory model (critical)
- `products_qty` rows are **batches** (lot number, expiry, quantity, status) of a `MedicineProduct`. `products_qty.quantity` is the single source of truth and is **always in pieces**.
- Transactions may be entered in `Piece` or `Box` (`App\Enums\UnitType`). Box quantities must be converted with `MedicineProduct::toPieces()` (multiplies by `pack_size`, throws `InvalidPackSizeException` if invalid) before touching stock. Legacy rows store lowercase `piece`/`box`, so always parse with `UnitType::fromInput()`.
- **`App\Services\InventoryStockService` is the only place that may mutate batch quantity** (`addStock`, `deductFromBatch`, `deductFefo`, `previewFefo`, ...). Deductions are FEFO (first-expiry-first-out); Expired/Deleted batch statuses are locked and never flipped by quantity changes. Never `increment`/`decrement` `quantity` directly in a controller.
- Every stock movement is recorded via `InventoryMovementLogger::log()`.
- POS sales that span batches keep one `SaleItem` per commercial line with per-batch rows in `SaleItemAllocation`.
- `resources/js/lib/units.js` mirrors the server conversion logic and limits (`MAX_TRANSACTION_QUANTITY`). Any change to conversion rules must be made on both sides.

### Write-path safeguards
- **Idempotency**: forms generate a key on open (`resources/js/lib/idempotency.js`) and send it with every retry; controllers call `IdempotencyGuard::claim(SCOPE_..., $key)` and `release()` on failure. Used by POS checkout, stock in, stock out, customer returns. New stock-mutating forms should follow the same pattern.
- **Document numbers** (e.g. POS invoice numbers) come from `DocumentNumberService`, and must be allocated inside the same DB transaction as the insert.
- Stock writes run inside DB transactions with row locks.

### Frontend structure
Inertia pages live in `resources/js/Pages/<Module>/` with a consistent layout: `Index.jsx` (page), `Partials/` (components), `Hooks/` (`useXxx.js` holding form state and submit logic), `lib/` (API/fetch helpers, pricing). Printable views (receipts, quotation print, transfer slip) are separate page components. `@/` aliases `resources/js`. Shared Inertia props (`HandleInertiaRequests`): `auth.user`, `flash.{success,error,sale_id}`, and `notifications.pendingStockTransfers` (admins only).

### Receipt printing
`ReceiptPrinterService` prints ESC/POS receipts (`mike42/escpos-php`) to printers configured in `config/printer.php` via `PRINTER_*` env vars (COM port or network). Add printers by adding a block there.

### Proxies
`bootstrap/app.php` trusts all proxies so ngrok/HTTPS tunnels generate correct URLs; don't sync `APP_URL` to the tunnel.

## Parallel agents
Three agents in `.claude/agents/` split a feature by directory:
- **backend-dev** owns `app/ routes/ database/ config/ tests/`, except `tests/Feature/Qa/`.
- **frontend-dev** owns `resources/js/ resources/css/`.
- **qa-engineer** owns `tests/Feature/Qa/` and never edits product code.

Backend-dev writes a contract to `.claude/handoff/<slug>.md` that lists routes, request fields and prop shapes. QA adds acceptance criteria and numbered `QA-<n>` findings to the same file, and each finding is fixed by the agent that owns the code. The agents message each other with `SendMessage`. Start all three with `/fullstack <feature>`.

## Notes
- On Windows, watch filename casing in imports (there was a past `Components/` vs `components/` merge conflict; Windows ignores case but a Linux VPS does not). Use `@/components/...`.
- `todo.txt` holds the client's outstanding feature requests.
