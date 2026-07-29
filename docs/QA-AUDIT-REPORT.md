# QA Audit Report — Westpoint Pharmacy Inventory System

| Field | Value |
|---|---|
| **System** | Westpoint Pharmacy & Medical Supplies — Multi-Branch Inventory & Stock Transfer |
| **Stack** | Laravel 11 + Inertia.js + React, MySQL (`strict = true`) |
| **Audit date** | 29 July 2026 |
| **Audit type** | Static read-only audit. No source files were modified. |
| **Focus** | Inventory calculations, unit conversion (Box/Wholesale vs. Piece/Retail), state management, input edge cases, concurrency |

**Modules reviewed**

`StockInController` · `StockOutController` · `PosController` · `MedicineInventoryController` · `StockTransferController` · `InventoryStockService` · `InventoryMovementLogger` · `MedicineProduct` · `ProductQty` · `useStockIn` · `useStockOut` · `useAddStock` · `useEditBatch` · `pricing.js` · `StockInModal` · `StockOutModal` · `EditBatchModal` · `TransferSlip`

---

## Executive Summary

The system stores inventory in **pieces** — `products_qty.quantity` is the single source of truth — and three of the four write paths correctly multiply by `pack_size` before touching it. **Stock Out does not.** A second defect in the Edit Batch modal round-trips the stored piece count through a box count using `Math.round`, mutating stock on save even when the user changes nothing else.

Both defects sit in high-traffic daily staff workflows, both corrupt data silently, and both compound: they overlap on the same batches, so historical drift cannot be reconstructed arithmetically and must be corrected against a physical count.

A contributing factor is the complete absence of test coverage for the Box path. Every POS and stock test in the suite passes `unit_type => 'Piece'`. The Box branch of the conversion logic has never been exercised by an automated test, which is consistent with these defects reaching production.

### Findings by severity

| Severity | Count | IDs |
|---|---|---|
| **Critical** | 8 | C-1 … C-8 |
| **High** | 6 | H-1 … H-6 |
| **Medium** | 8 | M-1 … M-8 |
| **Low / Observational** | 8 | L-1 … L-8 |
| **Total** | **30** | |

### Ship-blockers

The four findings that would change a deployment decision today:

| ID | Finding | Why it blocks |
|---|---|---|
| **C-1** | Stock Out ignores unit conversion | Corrupts inventory on every box dispense |
| **C-2** | Edit Batch corrupts stock on save | Corrupts inventory on routine, no-op edits |
| **C-6** | POS reports committed sales as failed | Causes operators to duplicate transactions |
| **C-8** | Expired stock is sellable and FEFO-preferred | Patient safety and regulatory exposure |

---

## 1. Critical Findings

---

### C-1 — Stock Out ignores unit conversion entirely

**Severity:** Critical  **Category:** Inventory correctness  **File:** `app/Http/Controllers/StockOutController.php`

#### Issue

`StockOutController::store` validates `unit_type` as `piece|box`, then deducts `quantity_deducted` straight from the batch without converting:

```77:81:westpoint/app/Http/Controllers/StockOutController.php
                    if (! $batch || $item['quantity_deducted'] > $batch->quantity) {
                        throw new \RuntimeException('Qty exceeds lot stock. Reduce or select another lot.');
                    }

                    $batch->decrement('quantity', $item['quantity_deducted']);
```

There is no `* $medicine->pack_size` anywhere in the file. The client does not convert either — `useStockOut` has no pieces preview, and its ceiling is `maxQuantity = Number(selectedLot.quantity)`, which is pieces, regardless of the selected unit.

For contrast, the three sibling paths all convert correctly: `StockInController:63`, `MedicineInventoryController:307`, `PosController:414`.

#### Steps to reproduce

1. Choose a product with `pack_size = 100` and a batch holding 500 pieces.
2. Open **Stock Out** and select that lot.
3. Enter quantity `5` and set Unit Type to **Box / Wholesale**.
4. Add to basket and submit.

**Expected:** 500 pieces deducted; batch emptied.
**Actual:** 5 pieces deducted; 495 remain. The receipt and history print `5 · Box / Wholesale`.

#### Impact

Five boxes physically leave the shelf while the system believes 99% of the stock is still present. The gap widens on every box dispense.

It also compounds financially. `confirmDelivery` prices the same line at wholesale:

```249:251:westpoint/app/Http/Controllers/StockOutController.php
                    $priceUsed = $item->unit_type === 'box'
                        ? (float) $medicine->wholesale_price
                        : (float) $medicine->retail_price;
```

So a sale is booked for five boxes of revenue against five pieces of deduction. Inventory and revenue drift in **opposite directions**, which defeats reconciliation — the error does not cancel out and is not detectable by comparing the two ledgers.

#### Fix

Do not simply add a multiplication to `StockOutController`. This bug exists because three call sites remembered to convert and one did not; a fourth manual multiplication leaves the identical trap for the next endpoint.

**1. Centralise the conversion.** Give the Box→pieces rule exactly one home. A model accessor is the smallest change that removes the duplication:

```php
// app/Models/MedicineProduct.php
public function toPieces(int $quantity, string $unitType): int
{
    $packSize = max((int) $this->pack_size, 1);

    return $this->isBoxUnit($unitType)
        ? $quantity * $packSize
        : $quantity;
}
```

Note the `max(..., 1)` floor — this also closes H-1/H-2. Unit-type comparison must be case-insensitive, because Stock In uses `Piece|Box` while Stock Out uses `piece|box` (see L-7).

**2. Make the unsafe operation unreachable.** Add `InventoryStockService::deductStock(...)` as the counterpart to the existing `addStock(...)`, accepting **pieces only**, and route every deduction through it. No controller should call `decrement('quantity', ...)` directly. Once that holds, forgetting to convert becomes a type-level impossibility rather than a review-time catch.

**3. Fix the client ceiling.** In `useStockOut`, compute the maximum as available pieces ÷ pack size when the unit is Box, and re-clamp whenever the unit changes (see M-5). Add the same `= N pieces` preview that `StockInModal` already renders, so the operator can see the conversion before submitting.

**4. Correct the historical drift before deploying.** Every existing `stock_out_items` row with `unit_type = 'box'` represents stock that physically left but was never deducted. Reconcile against a **physical count**, not a back-calculation: C-1 and C-2 overlap on the same batches and their combined effect cannot be disentangled arithmetically.

---

### C-2 — Edit Batch silently rewrites stock via a lossy round trip

**Severity:** Critical  **Category:** Silent data corruption — highest frequency
**Files:** `resources/js/Pages/MedicineInventory/Hooks/useEditBatch.js`, `app/Http/Controllers/MedicineInventoryController.php`

#### Issue

The hook converts the stored piece count down to boxes with rounding:

```17:19:westpoint/resources/js/Pages/MedicineInventory/Hooks/useEditBatch.js
        const packSize = medicine.pack_size || 1;
        const boxes =
            packSize > 0 ? Math.round(batch.quantity / packSize) : 0;
```

The controller then writes it back as an **absolute** quantity, not a delta:

```347:362:westpoint/app/Http/Controllers/MedicineInventoryController.php
        $quantityInPieces = $validated['boxes_received'] * $medicine->pack_size;
...
        $batch->update([
            'lot_number' => $validated['lot_number'] ?? null,
            'expiry' => $validated['expiry'] ?? null,
            'quantity' => $quantityInPieces,
            'shelf_number' => $validated['shelf_number'] ?? null,
        ]);
```

#### Steps to reproduce

1. Set `pack_size = 10`. Bring a batch to **25 pieces** — a completely normal state after piece-level POS sales.
2. Open **Edit Batch**. It displays `3` boxes, because `Math.round(2.5) === 3`.
3. Correct only the shelf number. Save.

**Expected:** 25 pieces, new shelf number.
**Actual:** 30 pieces. Five pieces created from nothing.

The mirror case destroys stock: 24 pieces → displays `2` boxes → saves 20 pieces, losing four.

#### Impact

Opening and saving the modal mutates stock even when the quantity field is untouched. Because piece-level sales guarantee non-multiples of `pack_size`, this fires constantly — it is the highest-frequency corruption path in the system.

Worse, the modal's only quantity field is *"Boxes (stock level)"*, so a batch of 25 pieces is **unrepresentable**. There is no value the user can enter that saves the number currently in the database.

#### Fix

**1. Edit in the storage unit.** The root cause is that the editor's unit differs from the storage unit, making every open/save a lossy conversion. Change the field to accept **pieces** directly, and show the box count as a read-only derived hint:

> `25 pieces  (2 boxes + 5 loose)`

If a box-denominated input is genuinely wanted for usability, provide both fields with the **piece field authoritative**, and never round on the way in.

**2. Rename the request field.** `boxes_received` is now a misnomer and, being an absolute set rather than an addition, was always misleading. Rename to `quantity_in_pieces` with validation `['required','integer','min:0']`, and drop the `* $medicine->pack_size` from the controller entirely.

**3. Treat it as an audited adjustment.** An absolute overwrite of a stock level is a stock **adjustment event**, not a field update. Require a mandatory reason, and log a **signed delta** (`new − old`) to `inventory_movement_logs` rather than the absolute level. This also fixes L-3, where the current code logs an absolute value into a column that holds deltas everywhere else.

---

### C-3 — Stock Out resolves lots by `lot_number` alone and can deduct from the wrong batch

**Severity:** Critical  **Category:** Traceability / recall safety  **File:** `app/Http/Controllers/StockOutController.php`

#### Issue

```71:75:westpoint/app/Http/Controllers/StockOutController.php
                    $batch = ProductQty::query()
                        ->where('product_id', $medicine->id)
                        ->where('lot_number', $item['lot_number'])
                        ->lockForUpdate()
                        ->first();
```

No status filter, no expiry or shelf disambiguation, no ordering.

Duplicate lot numbers are easy to create. `InventoryStockService::addStock` merges only when lot **and** expiry **and** shelf all match, so receiving lot `A1` twice with different expiries correctly produces two rows. But the client then picks with `find(l => l.lot_number === value)` — first match — while the server picks with `first()` in primary-key order. These need not agree.

#### Steps to reproduce

1. Stock in lot `A1`, expiry 2027-01-01, shelf A, 100 pcs.
2. Stock in lot `A1`, expiry 2028-01-01, shelf B, 100 pcs.
3. In Stock Out, select the **2028** lot and dispense 80.

**Actual:** The **2027** row is decremented. `StockOutItem.expiry` is then stamped from that wrong batch (`StockOutController:90`).

#### Impact

The delivery receipt carries an incorrect expiry date and the recall trail points at the wrong physical batch — the exact failure mode a lot-tracking system exists to prevent.

Because `status` is unfiltered, a `Deleted` batch can also be selected. Driving it negative hits the `unsignedBigInteger` column under `'strict' => true` (`config/database.php:58`), raising `SQLSTATE 22003`, which surfaces to the user as the generic *"Stock-out could not be saved."*

#### Fix

**Address batches by primary key, not by label.** The UI already holds the batch `id` — `MedicineInventoryController` selects it into the `batches` payload:

```49:54:westpoint/app/Http/Controllers/MedicineInventoryController.php
                    ->with(['batches' => function ($batchQuery) {
                        $batchQuery
                            ->where('status', '!=', 'Deleted')
                            ->orderBy('expiry')
                            ->select(['id', 'product_id', 'lot_number', 'expiry', 'shelf_number', 'quantity', 'status']);
                    }]);
```

Submit and resolve on `products_qty_id`, and treat `lot_number` as a **display label only**. This removes the ambiguity at its source instead of trying to disambiguate after the fact.

Validation becomes an ownership check rather than a string match:

```php
'items.*.products_qty_id' => ['required', 'integer', 'exists:products_qty,id'],
```

with a server-side assertion that the batch belongs to the named product, that the product belongs to the session branch, and that `status !== 'Deleted'`.

Apply the same treatment to `StockTransferController`, which already submits `products_qty_id` but re-derives the destination lot by `lot_number` (see H-5).

---

### C-4 — Stock Transfer accepts an unauthorised `from_branch_id` and an unvalidated lot

**Severity:** Critical  **Category:** Authorisation / IDOR  **File:** `app/Http/Controllers/StockTransferController.php`

#### Issue

```87:98:westpoint/app/Http/Controllers/StockTransferController.php
            'to_branch_id'               => 'required|exists:branches,id|different:from_branch_id',
            'from_branch_id'             => 'required|exists:branches,id',
...
            'items.*.products_qty_id'    => 'required|exists:products_qty,id',
```

Nothing checks that `from_branch_id` is the requester's own branch, that the lot belongs to the named product, or that the product belongs to the source branch. `moveStock` then does `ProductQty::findOrFail($item->products_qty_id)` and decrements it with **no branch check anywhere**.

#### Steps to reproduce

As any secretary, POST to `stock-transfers.store` with `from_branch_id` set to a different branch and `products_qty_id` set to one of that branch's lots. On admin approval, the stock moves out of the victim branch.

#### Impact

Cross-branch stock drain via a crafted request. Separately, because `product_id` and `products_qty_id` are validated independently, a lot of Product X can be transferred under the identity of Product Y, creating a destination batch labelled as the wrong medicine.

#### Fix

**1. Derive the source branch from the session, never from the request.** Use the pattern the sibling controllers already implement:

```190:199:westpoint/app/Http/Controllers/StockInController.php
    private function branchIdOrFail(): int
    {
        $branchId = session('branch_id');

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        return (int) $branchId;
    }
```

Ignore or hard-reject a mismatched `from_branch_id`. `StockInController:41` and `StockOutController:47` already do exactly this — `StockTransferController` is the outlier.

**2. Validate lot ownership at the boundary.** Each referenced lot must belong to the named product, and that product must belong to the source branch. Express these as validation rules or a form request so they fail cleanly with a 422 rather than deep inside `moveStock`.

**3. Re-assert on approval.** The approval runs later, potentially after the underlying rows have changed. Re-check ownership at `approve()` time; do not trust the values frozen at request time.

---

### C-5 — Transfer approval has no row lock and no re-check before moving stock

**Severity:** Critical  **Category:** Race condition (TOCTOU)  **File:** `app/Http/Controllers/StockTransferController.php`

#### Issue

`approve()` verifies availability in one loop, then calls `moveStock()`, which decrements without re-verifying:

```207:212:westpoint/app/Http/Controllers/StockTransferController.php
            foreach ($stockTransfer->items as $item) {
                $lot = ProductQty::find($item->products_qty_id);
                if (! $lot || $lot->quantity < $item->effective_qty) {
                    throw new \Exception("Insufficient stock for lot {$item->lot_number}.");
                }
            }
```

Neither read takes a lock. `PosController` gets this right by comparison — `assertSufficientBranchStock` and `deductStockFefo` both use `lockForUpdate()`.

#### Steps to reproduce

1. Begin approving a transfer for the full contents of a lot.
2. Concurrently complete a POS sale consuming the same lot.
3. The POS transaction takes its lock and commits; the approval's stale read then decrements below zero.

**Actual:** Strict mode raises an out-of-range error. Because `approve()` has **no `try`/`catch`**, the deliberate `throw new \Exception(...)` on line 210 also renders a **500 error page** rather than a user-facing message.

#### Fix

**1. Lock and re-check inside one transaction.** Select the source lots with `lockForUpdate()`, verify sufficiency, then deduct — with the verification reading the same locked rows the deduction will write. The current shape, where an unlocked read validates and a later write acts, is a textbook time-of-check-to-time-of-use gap.

**2. Move the check into `moveStock`.** Splitting validation and mutation across two loops is what created the window. Have `moveStock` perform the locked read, the sufficiency check, and the decrement together per item.

**3. Handle the failure.** Wrap `approve()` in the same `try`/`catch` the other controllers use, catching `RuntimeException` for user-facing messages and `Throwable` for reported-and-generic ones. Change `throw new \Exception` to `throw new \RuntimeException` so it routes to the friendly branch. Apply the same treatment to `reject()` and `cancel()`.

---

### C-6 — POS commits the sale, then prints, then reports failure if printing throws

**Severity:** Critical  **Category:** Duplicate sales  **File:** `app/Http/Controllers/PosController.php`

#### Issue

```473:495:westpoint/app/Http/Controllers/PosController.php
            DB::commit();

// For auto Print 
$sale->load('items.product');
app(\App\Services\ReceiptPrinterService::class)->printReceipt($sale);
...
        } catch (\Throwable $e) {
            DB::rollBack();

            return redirect()->back()
                ->with('error', 'Failed to process sale. Please try again.');
        }
```

The print call sits **after** `commit()` but **inside** the `try`. Any printer exception lands in the `catch`, where `rollBack()` is a no-op on an already-committed transaction.

#### Steps to reproduce

1. Disconnect or jam the receipt printer.
2. Complete a cash sale.

**Actual:** Stock is deducted, the `Sale` and `SaleItem` rows persist, the cart is deleted — and the cashier is told the sale failed.

#### Impact

Duplicated sales and double stock deduction, triggered by an operator responding *correctly* to a false error message. The cart has already been deleted, so the re-ring is manual and may not even match the original.

#### Fix

**1. Move printing outside the transaction's error boundary.** The sale is complete once the transaction commits. Printing is a downstream side effect and must never be able to report the sale as failed.

**2. Degrade gracefully.** Wrap the print in its own error handling that flashes a warning rather than an error:

> *Sale completed — invoice POS-20260729-00042. Receipt failed to print; use Reprint.*

Then surface a reprint action. `printInvoice` already exists as a route and can serve it.

**3. Queue it.** Longer term, dispatch printing as a queued job so a slow or offline printer never blocks the checkout response. This also removes the printer from the request's latency budget.

---

### C-7 — Invoice numbers are random; collisions abort sales

**Severity:** Critical  **Category:** Intermittent failure + audit  **File:** `app/Http/Controllers/PosController.php`

#### Issue

```919:922:westpoint/app/Http/Controllers/PosController.php
    private function generateInvoiceNumber(): string
    {
        return 'POS-' . date('Ymd') . '-' . str_pad((string) mt_rand(1, 99999), 5, '0', STR_PAD_LEFT);
    }
```

`sales.invoice_number` is `unique` (`15_create_tbl_sales_table.php:13`). Same-day collision probability follows the birthday problem:

| Sales per day | P(at least one collision) |
|---|---|
| 100 | ≈ 5% |
| 200 | ≈ 18% |
| 350 | ≈ 46% |
| 500 | ≈ 71% |

#### Impact

Sales fail at random with *"Failed to process sale"*, then succeed on retry — a pattern nearly impossible to diagnose from user reports. Non-sequential invoice numbering is also a poor fit for a Philippine pharmacy's audit and BIR obligations, which expect gapless ordered series.

#### Fix

**Replace randomness with a real sequence.** Randomness plus a unique constraint is a lottery you eventually lose.

Allocate a per-branch, per-day counter from a dedicated sequence table (or an atomic counter row) **inside** the sale transaction, so the allocation and the insert commit together. Format as `POS-{branch}-{YYYYMMDD}-{NNNNN}`.

A sequence also satisfies the audit expectation that invoice numbers are gapless and ordered — which random generation cannot provide even when it happens not to collide.

`generateDispenseInvoiceNumber` is already collision-free (it derives from `stock_out_id`, guarded by `delivery_confirmed`) and needs no change.

---

### C-8 — Expired stock is fully sellable and dispensable

**Severity:** Critical  **Category:** Patient safety / regulatory  **File:** `app/Models/ProductQty.php`

#### Issue

```37:42:westpoint/app/Models/ProductQty.php
    public function scopeAvailable($query)
    {
        return $query
            ->where('status', 'Active')
            ->where('quantity', '>', 0);
    }
```

No expiry predicate. `PosController::deductStockFefo` and `assertSufficientBranchStock` both use `available()`; `StockOutController` does not even filter on status. Only `StockTransferController:58` applies `where('expiry', '>', now())`.

Nothing anywhere in `app/` transitions a lapsed batch out of the active pool. `InventoryStockService` reacts only to quantity changes, and there is no scheduled command.

#### Impact

The exposure is **amplified by FEFO**. `deductStockFefo` orders by earliest expiry:

```833:834:westpoint/app/Http/Controllers/PosController.php
            ->orderByRaw('CASE WHEN expiry IS NULL THEN 1 ELSE 0 END')
            ->orderBy('expiry')
```

so the system does not merely permit the expired batch — it actively **prefers** it. The oldest, most-expired stock is dispensed first.

`StockInController` also validates `expiry_date` as merely `required|date` with no `after:today`, so expired goods can be received in the first place. The `has_expired` inventory filter surfaces the problem for a human, but nothing blocks the transaction.

For a pharmacy this is a patient-safety and regulatory finding, not an accounting one.

#### Fix

Two independent layers, both required:

**1. Hard block at the query layer.** Add an expiry predicate so expired batches cannot be selected, dispensed, or FEFO-allocated anywhere. Keep the existing scope for reporting and introduce a separate dispensable scope, so the inventory page can still *show* expired stock while POS and Stock Out cannot *consume* it:

```php
public function scopeDispensable($query)
{
    return $query->available()->where(function ($q) {
        $q->whereNull('expiry')->orWhereDate('expiry', '>=', now()->toDateString());
    });
}
```

Decide deliberately how `expiry IS NULL` should behave. The FEFO ordering already sorts nulls last, implying "unknown expiry is usable" — make that explicit rather than incidental.

**2. Scheduled sweep.** Add a daily task that transitions lapsed batches to a distinct **`Expired`** status so they leave the active pool and appear on a disposal worklist.

Use a *new* status — do not reuse `Inactive`. `Inactive` currently means "empty", and `afterStockAdded` will happily flip it back to `Active`:

```148:155:westpoint/app/Services/InventoryStockService.php
    public static function afterStockAdded(ProductQty $batch): void
    {
        $batch->refresh();

        if ((int) $batch->quantity > 0 && $batch->status !== 'Active' && $batch->status !== 'Deleted') {
            $batch->update(['status' => 'Active']);
        }
    }
```

Both `afterStockAdded` and `afterBatchQuantityChange` must be taught to leave `Expired` alone, exactly as they already leave `Deleted` alone.

**3. Block receipt of expired goods.** Add `after:today` to the Stock In expiry rule, with an explicit override path if receiving short-dated stock is a legitimate business case.

---

## 2. High Findings

---

### H-1 — Box stock-in with `pack_size = 0` silently books zero pieces

**Severity:** High  **File:** `app/Http/Controllers/StockInController.php`

```63:65:westpoint/app/Http/Controllers/StockInController.php
                    $quantityInPieces = $item['unit_type'] === 'Box'
                        ? $item['quantity_received'] * $medicine->pack_size
                        : $item['quantity_received'];
```

With `pack_size = 0`, a Box stock-in of 10 writes a `stock_in_items` row reading *"10 Box"*, logs a movement of `0`, and creates a `products_qty` row with quantity `0` that `afterStockAdded` leaves inactive. The receipt prints 10 boxes. Stock is zero. **No error is raised anywhere.**

The column defaults to 1 and `store`/`update` validate `min:1`, but `StockTransferController::moveStock` copies `pack_size` into newly-created destination products via `firstOrCreate` without revalidating, and legacy or seeded rows can hold `0`.

The same defect exists in `MedicineInventoryController::storeStock` (line 307) and `updateBatch` (line 347), where a zero `pack_size` **zeroes an existing batch outright**.

**Fix:** Covered by the `max((int) $this->pack_size, 1)` floor in the C-1 centralised converter, plus the invariant work in H-2. Until the data migration lands, a zero or null `pack_size` on a Box transaction must be a **hard validation error** — never a multiplication by zero.

---

### H-2 — Frontend defaults `pack_size` to 1; backend never does

**Severity:** High  **Files:** `resources/js/Pages/Pos/lib/pricing.js`, multiple hooks and controllers

The client consistently falls back to 1:

```39:47:westpoint/resources/js/Pages/Pos/lib/pricing.js
export function getPiecesRequired(product, unitType, quantity) {
    const qty = Number(quantity) || 0;

    if (unitType === "Box") {
        return qty * (Number(product.pack_size) || 1);
    }

    return qty;
}
```

`useStockIn`, `useAddStock`, and `useEditBatch` all use `pack_size || 1`. The server uses the raw value with no fallback — `PosController:696` casts `(int) $product->pack_size`, and Stock In / Add Stock use it bare.

**Impact:** For `pack_size = 0` the client computes *N* pieces and the server computes `0`. In POS this means the cart's stock ceiling and the server's deduction disagree: the sale succeeds, charges wholesale price, and **deducts nothing**. This client/server divergence is what makes H-1 silent rather than loud.

**Fix:** Make `pack_size ≥ 1` an **invariant** rather than a value each call site defends against. Enforce it in three places:

1. A database check constraint (or a `NOT NULL DEFAULT 1` plus application guard) on `tbl_products.pack_size`.
2. A validation floor of `min:1` on every write path that can set it — including the `firstOrCreate` in `moveStock`, which currently propagates a possibly-zero value into a new branch.
3. A data migration repairing existing rows, with a report of what was changed.

Once the invariant holds, **remove** the divergent `|| 1` fallbacks rather than replicating them server-side. Defensive fallbacks scattered across two languages are what allowed the two sides to disagree in the first place.

---

### H-3 — Split-batch POS lines rewrite the unit and the unit price

**Severity:** High  **File:** `app/Http/Controllers/PosController.php`

When a line spans more than one batch, `createSaleItemRows` writes one `SaleItem` per batch, discarding the Box unit:

```907:915:westpoint/app/Http/Controllers/PosController.php
            SaleItem::create([
                'sale_id' => $saleId,
                'product_id' => $lineItem['product_id'],
                'products_qty_id' => $deduction['batch_id'],
                'unit_type' => 'Piece',
                'quantity_sold' => $deduction['pieces'],
                'price_used' => round($portion / max($deduction['pieces'], 1), 2),
                'total_price' => $portion,
            ]);
```

**Reproduce:** `pack_size = 100`, wholesale ₱500. Batch A holds 60 pcs, batch B holds 200. Sell **2 Box** (200 pcs, ₱1,000).

| Path | Recorded as |
|---|---|
| Single batch | `2 Box @ ₱500.00 = ₱1,000.00` |
| Split batch (actual) | `60 Piece @ ₱5.00 = ₱300.00` + `140 Piece @ ₱5.00 = ₱700.00` |

**Impact:** Any "units sold by unit type" or "average selling price" report is wrong, and — worse — *inconsistent*: the same sale is recorded differently depending on incidental batch fragmentation. The derived `price_used` also breaks the invariant `price_used × quantity_sold = total_price` whenever pieces do not divide the portion evenly (₱100.00 over 3 pieces → `33.33 × 3 = 99.99` against a stored total of `100.00`).

**Fix:** Separate the commercial line from its batch allocations. The current schema overloads `sale_items` to serve as both, which *forces* the unit rewrite whenever a line spans batches.

Model them as two tables: a **sale line** preserving the customer-facing unit, quantity, and price; and child **allocation** rows recording which batch supplied how many pieces. Reporting then reads sale lines and stays consistent regardless of fragmentation, while traceability reads allocations. The derived-price rounding disappears entirely, because allocation rows no longer need a price.

---

### H-4 — Transfer approval can approve more than was requested

**Severity:** High  **File:** `app/Http/Controllers/StockTransferController.php`

```189:192:westpoint/app/Http/Controllers/StockTransferController.php
        $request->validate([
            'approved_quantities'   => 'nullable|array',
            'approved_quantities.*' => 'integer|min:1',
        ]);
```

No `max`. `effective_qty` returns the approved value unconditionally:

```49:52:westpoint/app/Models/StockTransferItem.php
    public function getEffectiveQtyAttribute(): int
    {
        return $this->quantity_approved ?? $this->quantity_requested;
    }
```

The only ceiling is the source lot's quantity. Request 10, submit `approved_quantities[id] = 10000`, and if the lot holds it, 10,000 move. `TransferSlip` then renders *"10000 of 10 req."* via its partial-approval badge.

**Fix:** Bound the approved quantity at the requested quantity per item. Because the limit is per-item, use a closure or a custom rule rather than a static `max`. Then decide explicitly whether over-approval is ever legitimate — if it is, make it a distinct action with its own audit trail and its own permission, not an unbounded field on the normal path.

---

### H-5 — Transfer destination merges lots by `lot_number` alone, discarding expiry

**Severity:** High  **File:** `app/Http/Controllers/StockTransferController.php`

```345:356:westpoint/app/Http/Controllers/StockTransferController.php
        $destLot = ProductQty::where('product_id', $destProduct->id)
            ->where('lot_number', $item->lot_number)
            ->first();
 
        if ($destLot) {
            // Lot already exists in destination → just add quantity
            $destLot->increment('quantity', $qtyToMove);
```

The destination row keeps **its own** expiry; the incoming `$item->expiry` is silently dropped.

**Reproduce:** Destination already holds lot `A1` expiring 2026-09. Transfer in lot `A1` expiring 2029-01. All units now carry the 2026-09 date — or, in the reverse case, stock expiring imminently gets relabelled with a far-future expiry.

**Impact:** FEFO ordering and recall traceability are corrupted. Either good stock is written off early, or **expired stock is dispensed as current** — which combines with C-8 into a direct safety issue.

This merge rule is also inconsistent with `InventoryStockService::addStock`, which correctly keys on lot + expiry + shelf. Two different merge semantics coexist in one system.

Separately, the destination product `firstOrCreate` matches on branch/name/dose/form/brand but **not** `pack_size`, so pieces can land in a product whose `pack_size` differs from the source — silently changing what "1 box" means for that stock.

**Fix:** Delete the bespoke merge logic and call `InventoryStockService::addStock` for the destination side. It already implements the correct lot + expiry + shelf key, handles the create-vs-increment branch, and normalises status. One merge rule, one implementation, one place to change it.

For the product match, either include `pack_size` in the `firstOrCreate` attributes or — better — refuse to auto-create the destination product and require it to be set up deliberately. Auto-creating a product as a side effect of a transfer approval is how metadata drifts between branches.

---

### H-6 — Stock transfers are absent from the inventory movement ledger

**Severity:** High  **File:** `app/Http/Controllers/StockTransferController.php`

`StockTransferController` never calls `InventoryMovementLogger`. It writes only `StockTransferLog`. Every other stock mutation — stock in, stock out, add stock, batch edit, batch delete — writes to `inventory_movement_logs`.

**Impact:** The Movement Logs panel is what an auditor reconciles against, and it silently omits all inter-branch movement. Reconstructing a branch's stock from the ledger will not match `products_qty`, with no indication why. A stock mutation that bypasses the ledger makes the whole ledger untrustworthy rather than merely incomplete.

**Fix:** Have every transfer movement write to `inventory_movement_logs` alongside the transfer-specific log — a negative entry at the source and a positive entry at the destination, both referencing the transfer number. Add the two movement types to `InventoryMovementLog`'s constants so they can be filtered.

The general rule worth enforcing in review: **if it changes `products_qty.quantity`, it writes to the ledger.** Centralising deductions in `InventoryStockService` (per C-1) makes this enforceable in one place rather than by convention.

---

## 3. Medium Findings

---

### M-1 — Double-submission is guarded only by a disabled button

**Severity:** Medium

`useStockIn`, `useStockOut`, and `usePosCart` rely on Inertia's `processing` flag to disable the submit button. Pressing **Enter** inside any text input still calls `handleSubmit` → `post()`. There is no idempotency key, no unique constraint on `(stock_in_id, batch_number, pd_id)`, and no server-side dedupe window.

Stock In has no stock check at all, so a duplicate just doubles the received quantity — and because `addStock` merges on lot + expiry + shelf, the duplicate merges into the same batch and looks like one legitimately larger delivery. It is effectively undetectable after the fact.

Stock Out and POS are *partially* protected: the second request re-reads under `lockForUpdate` and fails on insufficient stock — but only when stock is tight. With ample stock, both submissions succeed and dispense twice.

**Fix:** Add idempotency. Generate a token per form instance client-side, send it with the submission, record it server-side, and return the original result for a repeat token instead of reprocessing. This is the only approach that holds against network retries, double-taps, and Enter-key spam alike. Disabling the button addresses one of three vectors.

Stock In needs this most, since it has no stock check to accidentally catch the duplicate.

---

### M-2 — No upper bound on any quantity input

**Severity:** Medium

`quantity_received`, `boxes_received`, `quantity_deducted`, `quantity_requested`, and `quantity_sold` are all `integer|min:1` with **no `max`**.

The column widths differ along the chain:

| Column | Type | Max |
|---|---|---|
| `products_qty.quantity` | `unsignedBigInteger` | 1.8 × 10¹⁹ |
| `stock_in_items.quantity_received` | `integer` (signed) | 2,147,483,647 |
| `inventory_movement_logs.quantity` | `integer` (signed) | 2,147,483,647 |

**Reproduce:** Stock in 2,000,000,000 Box of a `pack_size = 10` product. `2e9 × 10 = 2e10` overflows the signed-int movement-log column, strict mode raises `22003`, and the whole transaction rolls back behind the generic *"Stock-in could not be saved"* message — which reads like a validation problem, not an overflow.

**Fix:** Mirror a documented maximum on both sides, sized to the **narrowest** column in the chain (the signed-int movement log), not the widest. Add `max` rules server-side and clamp client-side at the same value. A realistic pharmacy ceiling — say 1,000,000 — is far below the technical limit and gives a clear error instead of a database exception.

---

### M-3 — Fractional input is accepted client-side and rejected server-side unhelpfully

**Severity:** Medium

The quantity inputs are `type="number"` with `min="1"` but **no `step="1"`**. `useStockIn.addItemToBasket` guards only `Number(draft.quantity_received) < 1`, so `2.5` passes and enters the basket.

Server-side, `items.*.quantity_received => integer` fails with the key `items.0.quantity_received`. `StockInModal` renders the array-level `errors.items` key plus some indexed keys, so the message may not appear next to the offending row.

`useStockOut` is worse — neither `updateDraft` nor `normalizeQuantity` floors:

```130:136:westpoint/resources/js/Pages/MedicineInventory/Hooks/useStockOut.js
            const parsed = Number(current.quantity_deducted);
            const normalized = Math.max(
                1,
                Math.min(max, Number.isNaN(parsed) ? 1 : parsed),
            );

            return { ...current, quantity_deducted: normalized };
```

A pasted `2.5` survives all the way to submission.

**Fix:** Normalise at a single client entry point that floors to an integer, rejects non-finite values and exponent forms, and clamps to the M-2 maximum. Add `step="1"` to the numeric inputs. Ensure per-item validation errors render against the offending basket row — an indexed failure surfacing at the array level appears to come from nowhere.

---

### M-4 — Transient-zero handling can silently clamp a valid entry to 1

**Severity:** Medium

`useStockOut.updateDraft` deliberately allows `0` and `""` mid-edit so backspacing is not fought on every keystroke — a reasonable design. But the ceiling falls back to `1` whenever the lot does not resolve:

```109:118:westpoint/resources/js/Pages/MedicineInventory/Hooks/useStockOut.js
                const lots = productMap[current.pd_id]?.batches ?? [];
                const lot = lots.find(
                    (l) => l.lot_number === current.lot_number,
                );
                const max = lot ? Number(lot.quantity) : 1;
...
                next.quantity_deducted = Math.min(max, Math.max(0, parsed));
```

If `lot_number` momentarily fails to resolve — for instance after `handleSubmit`'s partial reload replaces `products` while the modal is open — the user types `50` and sees `1`.

The same partial reload (`only: ["stockOuts", "medicines", "products", "movementLogs"]`) can leave `data.items` holding stale `lot_number` strings and stale ceilings for lots that have since changed or disappeared.

**Fix:** Distinguish "no lot selected" from "lot not found" and fall back to `0` with the input disabled, rather than to `1`. Never silently clamp a user's typed value to a fallback ceiling — if the lot cannot be resolved, surface that. On partial reload, re-validate basket items against the refreshed product data and flag any that no longer fit.

---

### M-5 — Switching unit or medicine mid-form does not re-validate

**Severity:** Medium

**Stock Out:** `updateDraft` resets the quantity when `pd_id` or `lot_number` changes, but has no branch for `unit_type`. This is currently masked by C-1 (stock out does not convert at all) — but the moment C-1 is fixed, a user who types `500` as pieces and then flips to Box will submit **500 boxes**.

**Stock In:** `updateDraft` is a blind spread with no per-field logic at all:

```63:68:westpoint/resources/js/Pages/MedicineInventory/Hooks/useStockIn.js
    const updateDraft = (field, value) => {
        setDraft((current) => ({
            ...current,
            [field]: value,
        }));
    };
```

Changing the medicine does **not** reset `batch_number`, `expiry_date`, or `quantity_received` — so a lot number and expiry belonging to medicine A silently carry onto medicine B. That is precisely how mislabelled batches are created.

**Also:** basket items snapshot `pack_size` at add time (`useStockIn:95`), but the server re-reads `$medicine->pack_size` at submit time. If an admin edits `pack_size` in another tab in between, the printed preview and the booked quantity differ with no warning.

**Fix:** Treat unit type as a field that invalidates dependent state, exactly as `pd_id` and `lot_number` already are. On unit change, re-clamp the quantity against the new unit's ceiling and re-render the pieces preview. In `useStockIn`, changing the medicine must clear the lot number, expiry, and quantity.

For the snapshot: either send it and have the server reject on mismatch, or drop it and let the server be authoritative for the preview too. Fix C-1's centralised converter makes the second option straightforward.

---

### M-6 — Stock In does not validate expiry against the existing lot, or reject past dates

**Severity:** Medium

`expiry_date => required|date` — no `after:today`, so already-expired goods can be received (which then sell, per C-8).

Nothing checks that a re-used `batch_number` carries a consistent expiry. `addStock` correctly treats lot `A1`/2027 and lot `A1`/2028 as different batches, but the user gets **no warning** that they have created a duplicate lot number — which is exactly the precondition for C-3.

**Fix:** Add `after:today` to the expiry rule (with a deliberate override path for short-dated receipts). Separately, when a submitted `batch_number` already exists for that product with a *different* expiry, warn the operator and require confirmation. Most of the time it is a typo; occasionally it is legitimate, and the operator is the right person to decide.

---

### M-7 — POS low-stock threshold ignores the product's own `stock_threshold`

**Severity:** Medium

```7:21:westpoint/resources/js/Pages/Pos/lib/pricing.js
export function getPosStockStatus(totalStock, packSize) {
    const stock = Number(totalStock) || 0;
    const pack = Number(packSize) || 1;
    const lowThreshold = pack * 2;
```

The server uses a different rule entirely:

```85:85:westpoint/app/Models/MedicineProduct.php
        $thresholdSql = 'COALESCE(tbl_products.stock_threshold, 10)';
```

`stock_threshold` is a real, editable, per-product column that POS ignores in favour of a `pack × 2` heuristic.

**Reproduce:** `pack_size = 100`, `stock_threshold = 50`, on hand 150. Inventory page says **In Stock** (150 > 50). POS says **Low Stock** (150 ≤ 200). Two screens, two answers, same product, same moment.

**Fix:** Have the POS badge use the same threshold logic as the inventory page — `stock_threshold` with a documented default. Ideally compute the status server-side once and ship it with the product payload, so there is a single implementation rather than two that must be kept in sync. Two screens disagreeing about stock health erodes trust in both.

---

### M-8 — `normalizeCartQuantityInput` coerces empty or zero to 1

**Severity:** Medium

```79:95:westpoint/resources/js/Pages/Pos/lib/pricing.js
export function normalizeCartQuantityInput(rawValue, maxQty) {
    const trimmed = String(rawValue ?? "").trim();

    if (trimmed === "" || trimmed === "0") {
        return 1;
    }
...
    const cap = Math.max(Number(maxQty) || 0, 1);

    return Math.min(parsed, cap);
}
```

Clearing the quantity box and clicking away silently sets `1` rather than restoring the previous value. The `cap` floor of 1 also means a product with **0** available normalises to 1, which then fails server-side.

**Fix:** Restore the previous value on empty input rather than defaulting to 1, and let the cap reach 0 so an out-of-stock product cannot be silently coerced into a quantity the server will reject. The floor exists to avoid a confusing `0` in the UI; disabling the input for out-of-stock products solves that without lying about the cap.

---

## 4. Low / Observational Findings

| ID | Finding | Fix |
|---|---|---|
| **L-1** | `TransferSlip` renders `item.product?.unit`, an attribute that does not exist on `MedicineProduct` (absent from `$fillable` and from migration 13). The **Unit** column prints `—` on every row. | Render the product's `form`, or add a real `unit` column. |
| **L-2** | `TransferSlip.totalQty` sums approved-or-requested quantities across products with no unit awareness, then labels the result *"Total units transferred"* — adding pieces of one product to boxes of another. The reduce also has no `?? 0` fallback, so an item with both quantities null yields `NaN`. | Make the total unit-aware, or relabel it as a line-item count. Add the zero fallback. |
| **L-3** | `MedicineInventoryController::updateBatch` logs `quantity: $quantityInPieces` — an absolute level — into a column that holds signed deltas everywhere else. Summing the ledger yields nonsense. | Log the signed delta. Covered by the C-2 fix. |
| **L-4** | `InventoryStockService::addStock` accepts a `$branchId` parameter but only uses it in a `whereHas('product')` guard. Since `product_id` already determines the branch, the argument is decorative — and gives false confidence that callers are branch-scoped. | Remove the parameter, or make it an assertion that throws on mismatch. |
| **L-5** | `addStock`'s matching query excludes only `status = 'Deleted'`, so a soft-deleted batch with identical lot/expiry/shelf will not merge — producing a parallel row with the same identifiers. Another route to the duplicate-lot precondition of C-3. | Decide deliberately whether soft-deleted batches should block or absorb a merge; document either way. |
| **L-6** | `PosController::getOrCreateActiveCart` uses `firstOrCreate` on `(branch_id, user_id)` with no unique index on `tbl_carts`. Two concurrent tabs can create two "active" carts. | Add the unique index; `firstOrCreate` is only atomic when the database enforces it. |
| **L-7** | Unit-type casing is inconsistent across the system: Stock In and POS use `Piece`/`Box`; Stock Out uses `piece`/`box`. `confirmDelivery` has to translate (`$item->unit_type === 'box' ? 'Box' : 'Piece'`). Every comparison is a casing bug waiting to happen. | Normalise on one casing with a shared enum or constant; migrate existing `stock_out_items` rows. |
| **L-8** | `StockOutController::confirmDelivery` reads `wholesale_price`/`retail_price` at confirmation time, not at dispense time. A price edit in between silently changes the recorded sale value. | Snapshot the price onto `stock_out_items` at dispense time and read the snapshot at confirmation. |

---

## 5. Edge Cases Covered

Scenarios traced through the code. **Pass** = behaves correctly. **Fail** = produces a wrong or unsafe result.

### 5.1 Unit conversion and calculation logic

| # | Scenario | Result | Ref |
|---|---|---|---|
| 1 | Stock In, unit = Box, valid `pack_size` | Pass | — |
| 2 | Stock Out, unit = Box | **Fail — Critical** | C-1 |
| 3 | POS checkout, unit = Box, single batch | Pass | — |
| 4 | POS checkout, unit = Box, spanning 2+ batches | **Fail — High** | H-3 |
| 5 | `pack_size = 0`, Stock In as Box | **Fail — High** | H-1 |
| 6 | `pack_size = 0`, Edit Batch save | **Fail — High** | H-1 |
| 7 | `pack_size` null — client fallback vs. server | **Fail — High** | H-2 |
| 8 | Fractional quantity `2.5` | **Fail — Medium** | M-3 |
| 9 | Quantity `0` | Pass | — |
| 10 | Negative quantity | Pass | — |
| 11 | Exponent input `1e3` | **Fail — Low** | M-3 |
| 12 | Batch holding a non-multiple of `pack_size` | **Fail — Critical** | C-2 |

### 5.2 Boundary and edge cases

| # | Scenario | Result | Ref |
|---|---|---|---|
| 13 | Very large quantity (2 × 10⁹ Box × pack 10) | **Fail — Medium** | M-2 |
| 14 | No `max` on any quantity rule | **Fail — Medium** | M-2 |
| 15 | Large values in printed tables | **Fail — Low** | L-2 |
| 16 | Double-submit Stock In via Enter key | **Fail — Medium** | M-1 |
| 17 | Double-submit Stock Out / POS | **Partial** — lock saves you only when stock is tight | M-1 |
| 18 | Concurrent POS sale vs. transfer approval | **Fail — Critical** | C-5 |
| 19 | Concurrent POS sale vs. POS sale | Pass — correct lock and re-check | — |
| 20 | Switch unit type mid-form (Stock Out) | **Fail — Medium** | M-5 |
| 21 | Switch medicine mid-form (Stock In) | **Fail — Medium** | M-5 |
| 22 | `pack_size` edited in another tab mid-form | **Fail — Medium** | M-5 |
| 23 | Stock In an item with missing metadata | **Fail — High** | H-1 |
| 24 | Duplicate lot number, differing expiry | **Fail — Critical** | C-3 |
| 25 | Deleted batch targeted by Stock Out | **Fail — Critical** | C-3 |
| 26 | Transfer approving more than requested | **Fail — High** | H-4 |
| 27 | Transfer into a branch where the lot exists | **Fail — High** | H-5 |
| 28 | Expired batch in POS / Stock Out | **Fail — Critical** | C-8 |
| 29 | Receiving already-expired goods | **Fail — Medium** | M-6 |
| 30 | Zero-stock product normalised in POS cart | **Fail — Low** | M-8 |

### 5.3 Data integrity and consistency

| # | Scenario | Result | Ref |
|---|---|---|---|
| 31 | DB pieces vs. Stock-In receipt display | Pass — receipt shows entered unit by design | — |
| 32 | DB pieces vs. Stock-Out receipt display | **Fail — Critical** | C-1 |
| 33 | Low-stock badge: POS vs. Inventory page | **Fail — Medium** | M-7 |
| 34 | Movement ledger reconciles to `products_qty` | **Fail — High** | H-6 |
| 35 | Movement log `quantity` semantics | **Fail — Low** | L-3 |
| 36 | `price_used × quantity_sold = total_price` | **Fail — High** | H-3 |
| 37 | Batch merge rules consistent across the app | **Fail — High** | H-5 |
| 38 | Price captured at dispense vs. at confirmation | **Fail — Low** | L-8 |
| 39 | POS rounding of `net_amount` | Pass | — |
| 40 | Test coverage of the Box path | **Fail** | §7 |

---

## 6. Recommended Fixes / Action Plan

Conceptual guidelines only — no implementation patches in this document. Each phase is independently shippable; later phases must not be required for earlier ones to land safely.

**Effort key:** S = small (≤ 1 day) · M = medium (2–3 days) · L = large (3+ days / schema or cross-module)

---

### Phase 0 — Stop the bleeding

Deploy before anything else. These findings corrupt inventory, money, or patient-safety outcomes on every use.

> **Sequencing note:** C-1 and C-2 overlap on the same batches. Complete a **physical stock count** *before* deploying either fix, or the post-fix figures will encode the pre-fix drift and become unverifiable.

#### C-1 — Centralise unit conversion; route Stock Out through pieces-only deduction · Est. L

Do **not** simply multiply by `pack_size` inside `StockOutController`. That is how the bug happened: three call sites remembered and one forgot.

1. **One conversion home.** Add a single rule on `MedicineProduct` (or a dedicated converter) that turns `(quantity, unit_type)` into pieces. Floor `pack_size` at 1 inside that rule so H-1/H-2 cannot produce a silent zero. Compare unit types case-insensitively until L-7 normalises casing.
2. **Pieces-only mutation API.** Add `InventoryStockService::deductStock(...)` as the counterpart to `addStock(...)`. It accepts pieces only. No controller may call `decrement('quantity', ...)` directly. Forgetting to convert then becomes structurally unreachable.
3. **Client ceiling and preview.** In `useStockOut`, when unit is Box, max quantity = `floor(availablePieces / packSize)`. Re-clamp on unit change (ties to M-5). Show the same `= N pieces` preview Stock In already has.
4. **Historical drift.** Query every `stock_out_items` row with `unit_type = 'box'`. Do **not** back-calculate deductions — C-1 and C-2 compound on the same lots. Reconcile against a physical count, then deploy the code fix.

#### C-2 — Edit Batch in the storage unit (pieces) · Est. M

1. Change the quantity field to accept **pieces**. Show boxes as a read-only hint (`25 pieces = 2 boxes + 5`). Never round on the way in or out.
2. If a box input is still wanted for UX, keep both fields with the **piece field authoritative**.
3. Rename the request field away from `boxes_received` so the API cannot be misread.
4. Treat absolute quantity overwrite as an **adjustment**: require a reason, and log a **signed delta** into the movement ledger (also closes L-3).

#### C-6 — Decouple receipt printing from sale success · Est. S

1. Keep `DB::commit()` as the point of sale success.
2. Move `ReceiptPrinterService::printReceipt` **outside** the transaction `try`/`catch` that rolls back and reports failure — or catch printer errors separately.
3. On printer failure: flash a **warning** (“Sale completed — receipt failed to print”) and offer Reprint. Never tell the cashier the sale failed after stock and the sale row already exist.
4. Prefer a queued print job so a slow/offline printer never blocks checkout.

#### C-8 — Block expired stock from sale and dispense · Est. M

1. Add a **dispensable** scope (or extend `available`) that excludes batches with `expiry < today`. Use it in POS FEFO, Stock Out lot lists, and stock sufficiency checks.
2. Introduce a distinct status `Expired` (do not reuse `Inactive` — restock reactivation would revive expired lots).
3. Schedule a daily job that marks lapsed Active batches as `Expired` and feeds a disposal worklist.
4. Add `after:today` (or an explicit short-dated override) to Stock In expiry validation so expired goods cannot be received by accident.

| ID | Action summary | Est. |
|---|---|---|
| C-1 | Centralise conversion + `deductStock` + client preview; physical count first | L |
| C-2 | Piece-denominated Edit Batch; signed-delta adjustment log | M |
| C-6 | Print outside sale error boundary; warning + reprint | S |
| C-8 | Dispensable scope; `Expired` sweep; Stock In date rule | M |

---

### Phase 1 — Authorisation and concurrency

#### C-4 — Derive source branch from session; validate lot ownership · Est. M

1. Set `from_branch_id` from `session('branch_id')` / `branchIdOrFail()`. Ignore or hard-reject a mismatched request body field — same pattern as Stock In / Stock Out.
2. At store time, assert each `products_qty_id` belongs to the named `product_id`, and that product belongs to the source branch. Prefer Form Request / custom rules so failures are 422s, not deep exceptions.
3. Re-assert ownership and stock at `approve()` time; do not trust values frozen when the request was created.

#### C-5 — Lock, re-check, and fail friendly on transfer approval · Est. M

1. Inside one DB transaction: `lockForUpdate()` on source lots, verify `quantity >= effective_qty`, then deduct. Verification and write must use the same locked rows (close the TOCTOU gap).
2. Prefer routing the deduction through `InventoryStockService::deductStock` once Phase 0 lands.
3. Wrap `approve` / `reject` / `cancel` in `try`/`catch` so insufficiency returns a redirect flash, never a raw 500.

#### C-7 — Sequential invoice numbers · Est. M

1. Replace `mt_rand` with a per-branch, per-day (or global) sequence allocated **inside** the sale transaction (dedicated sequence table or atomic counter row).
2. Keep the unique constraint; retries should consume the next sequence value, not reshuffle randomness.
3. Document gap policy for rolled-back transactions (acceptable gaps vs. BIR gapless expectations).

#### H-4 — Cap approved quantity at requested · Est. S

1. Validate each `approved_quantities[id]` with `min:1` and `max: quantity_requested` for that item (closure / custom rule).
2. If over-approval is a real business need, make it a separate privileged action with its own audit trail — not an unbounded field on the normal path.

#### M-1 — Idempotency tokens on mutating forms · Est. M

1. Generate a client token per form instance; send it with Stock In, Stock Out, and POS checkout.
2. Persist tokens server-side; on repeat token, return the original success result without reprocessing.
3. Do not rely on `processing` / disabled buttons alone — Enter-key and network retry still double-submit.

| ID | Action summary | Est. |
|---|---|---|
| C-4 | Session-derived `from_branch_id`; lot ownership rules; re-check on approve | M |
| C-5 | `lockForUpdate` + re-check; friendly errors | M |
| C-7 | Per-branch sequential invoice allocation | M |
| H-4 | Bound approval qty ≤ requested | S |
| M-1 | Idempotency tokens on Stock In / Out / checkout | M |

---

### Phase 2 — Conversion robustness and consistency

#### H-1 / H-2 — Make `pack_size ≥ 1` an invariant · Est. M

1. **Database:** non-null default 1; check constraint or app-level enforcement that rejects 0.
2. **Validation:** every create/update path (including transfer `firstOrCreate` product copy) requires `integer|min:1`.
3. **Data migration:** repair existing 0/null rows to 1 (or a known correct pack size from master data).
4. **Then** remove divergent client `|| 1` fallbacks so preview and server never disagree. Until migration lands, Box transactions with bad `pack_size` must hard-fail validation — never multiply by zero.

#### C-3 — Address batches by primary key · Est. M

1. Submit `products_qty_id` from Stock Out (UI already has batch `id` in the products payload). Treat `lot_number` as display-only.
2. Server: resolve by id; assert product + branch ownership; exclude `Deleted`.
3. Stop matching Stock Out deductions with `where('lot_number', ...)->first()`.

#### H-5 — One merge rule for destination lots · Est. M

1. Replace bespoke destination `where(lot_number)->increment` with `InventoryStockService::addStock` (lot + expiry + shelf).
2. Stop auto-creating destination products as a silent side effect of approval — require the product to exist (or match including `pack_size`) so metadata cannot drift between branches.

#### H-3 — Separate sale lines from batch allocations · Est. L

1. Keep one commercial sale line: customer-facing unit, quantity, price.
2. Child allocation rows: which batch supplied how many **pieces** (no unit rewrite, no derived per-piece price).
3. Reporting reads sale lines; recall/traceability reads allocations. Removes split-batch `Piece` rewrite and `price_used × qty ≠ total` rounding.

#### H-6 — Transfers must write the movement ledger · Est. S

1. On approve/move: negative ledger entry at source, positive at destination, both referencing the transfer number.
2. Add movement-type constants for transfer out / transfer in.
3. Review rule: **if it changes `products_qty.quantity`, it writes to `inventory_movement_logs`.** Enforcing deductions via `InventoryStockService` makes this one place instead of convention.

| ID | Action summary | Est. |
|---|---|---|
| H-1 / H-2 | DB + validation + migration for `pack_size ≥ 1` | M |
| C-3 | Stock Out by `products_qty_id` | M |
| H-5 | Destination merge via `addStock`; no silent product create | M |
| H-3 | Sale line + allocation schema split | L |
| H-6 | Transfer ledger entries both ends | S |

---

### Phase 3 — Input handling and display

#### M-2 / M-3 — Normalise and bound quantities · Est. M

1. One client helper: floor to integer, reject non-finite / exponent forms, clamp to a documented max.
2. Mirror the same `max` on every server quantity rule; size it to the **narrowest** column (signed-int movement log), e.g. a pharmacy-realistic ceiling such as 1,000,000.
3. Add `step="1"` on numeric inputs.
4. Render indexed validation errors next to the offending basket row, not only under `errors.items`.

#### M-5 — Invalidate dependent state on unit / medicine change · Est. S

1. On unit change in Stock Out: re-clamp quantity to the new ceiling; refresh pieces preview.
2. On medicine change in Stock In: clear lot number, expiry, and quantity (do not carry another product’s lot forward).
3. Either drop client-snapshotted `pack_size` and trust the server, or send the snapshot and reject on mismatch at submit.

#### M-4 — Honest empty-lot ceilings · Est. S

1. Distinguish “no lot selected” from “lot not found”.
2. Fall back to max `0` with the input disabled — never silently clamp typed values to `1`.
3. After partial Inertia reload, re-validate basket lines against refreshed stock and flag lines that no longer fit.

#### M-7 — One low-stock definition · Est. S

1. POS badge must use the same rule as inventory: product `stock_threshold` with a documented default (not `pack_size × 2`).
2. Prefer computing status once server-side and shipping it on the product payload.

#### M-6 / M-8 — Expiry / lot warnings and cart empty-input behaviour · Est. S

1. Stock In: warn when the same `batch_number` exists with a different expiry; require confirmation.
2. Cart qty: on empty blur, restore previous value; allow cap of 0 for out-of-stock; disable the control instead of coercing to 1.

#### L-1 … L-8 — Display and consistency cleanup · Est. S each

| ID | Action |
|---|---|
| L-1 | Transfer slip Unit column: use a real field (`form`) or add `unit` — stop reading missing `product.unit` |
| L-2 | Relabel or make transfer total unit-aware; add `?? 0` in the reduce |
| L-3 | Closed by C-2 signed-delta logging |
| L-4 | Make `addStock`’s `$branchId` an assertion or remove it |
| L-5 | Document whether soft-deleted batches block or absorb merges |
| L-6 | Unique index on `(branch_id, user_id)` for carts |
| L-7 | One casing for unit types (`Piece`/`Box`); migrate `stock_out_items`; do with Phase 2 |
| L-8 | Snapshot price onto stock-out items at dispense; confirmDelivery reads the snapshot |

| ID | Action summary | Est. |
|---|---|---|
| M-2 / M-3 | Shared qty normalisation + mirrored max + row errors | M |
| M-5 | Re-clamp / reset on unit & medicine change | S |
| M-4 | Empty-lot max = 0; basket re-validate | S |
| M-7 | Unified low-stock threshold | S |
| M-6 / M-8 | Duplicate-lot warn; cart empty restore | S |
| L-1 … L-8 | Slip, ledger, casing, price snapshot, cart unique | S |

---

### Phase 4 — Regression safety (before / with every fix)

Write **failing tests first** that pin intended behaviour, then land the fix. Box-path coverage is currently zero; that is why conversion bugs are systemic.

Priority tests (full matrix in §7):

1. Box stock-out deducts `qty × pack_size`.
2. Non-multiple piece batch survives Edit Batch unchanged.
3. Split-batch Box POS sale preserves Box on the sale line.
4. Zero `pack_size` hard-fails validation.
5. Transfer cannot name a foreign `from_branch_id`.
6. Expired batch never allocated by FEFO / Stock Out.
7. Concurrent POS vs transfer approval — no negative stock, friendly error.
8. Printer failure still reports sale success.
9. Duplicate idempotency token books once.

Harness: seed a product with `pack_size > 1` and a batch at a non-multiple of pack size; add a concurrency helper; keep a legacy `pack_size = 0` fixture until the migration is proven.

---

### Fix checklist (all findings)

| ID | Severity | Fix in one line | Phase | Est. |
|---|---|---|---|---|
| C-1 | Critical | Centralise Box→pieces; `deductStock`; fix Stock Out client/server | 0 | L |
| C-2 | Critical | Edit Batch in pieces; signed-delta adjustment | 0 | M |
| C-3 | Critical | Resolve Stock Out by `products_qty_id` | 2 | M |
| C-4 | Critical | Session `from_branch_id` + lot ownership | 1 | M |
| C-5 | Critical | Lock + re-check on approve; catch errors | 1 | M |
| C-6 | Critical | Print outside sale failure path | 0 | S |
| C-7 | Critical | Sequential invoice numbers | 1 | M |
| C-8 | Critical | Block / sweep expired stock | 0 | M |
| H-1 | High | Reject / migrate `pack_size = 0` | 2 | M |
| H-2 | High | Align client/server pack_size (invariant) | 2 | M |
| H-3 | High | Sale line + allocation split | 2 | L |
| H-4 | High | Cap approval ≤ requested | 1 | S |
| H-5 | High | Destination merge via `addStock` | 2 | M |
| H-6 | High | Transfer writes movement ledger | 2 | S |
| M-1 | Medium | Idempotency tokens | 1 | M |
| M-2 | Medium | Quantity max bounds | 3 | M |
| M-3 | Medium | Integer-only qty normalisation | 3 | M |
| M-4 | Medium | Honest empty-lot ceiling | 3 | S |
| M-5 | Medium | Re-validate on unit/medicine change | 3 | S |
| M-6 | Medium | Expiry / duplicate-lot rules | 3 | S |
| M-7 | Medium | Unified low-stock threshold | 3 | S |
| M-8 | Medium | Cart empty-input restore | 3 | S |
| L-1…L-8 | Low | Slip, ledger, casing, snapshot, cart unique | 3 | S |

---

## 7. Regression Test Plan

**The absence of any Box-path test is why this class of defect is systemic rather than isolated.** Every POS and stock test in the suite passes `unit_type => 'Piece'`:

- `BatchDeactivationTest` — lines 29, 39, 75, 85, 126
- `StockBatchMergeTest` — lines 66, 104
- `WestpointFeatureTest` — lines 118, 135, 160, 179, 195, 204

Write these as **failing tests first**, pinning intended behaviour before any fix lands. The tests are the actual deliverable; the fixes are comparatively mechanical once expectations are encoded.

### Required coverage

| # | Test | Pins |
|---|---|---|
| 1 | Box stock-out deducts `qty × pack_size` from the batch | C-1 |
| 2 | Box stock-out receipt quantity matches the pieces deducted | C-1 |
| 3 | A batch at a non-multiple of `pack_size` survives an Edit Batch save unchanged | C-2 |
| 4 | Edit Batch can represent and save an arbitrary piece count | C-2 |
| 5 | Stock Out targets the exact batch selected when lot numbers collide | C-3 |
| 6 | Stock Out refuses a `Deleted` batch | C-3 |
| 7 | A transfer naming a foreign `from_branch_id` is rejected | C-4 |
| 8 | A transfer naming a lot outside the source branch is rejected | C-4 |
| 9 | Concurrent POS sale and transfer approval on one lot — no negative stock, friendly error | C-5 |
| 10 | A printer failure still reports the sale as successful | C-6 |
| 11 | Invoice numbers are unique and sequential across N concurrent sales | C-7 |
| 12 | An expired batch is never allocated by FEFO | C-8 |
| 13 | An expired batch cannot be dispensed via Stock Out | C-8 |
| 14 | Stock In rejects an expiry date in the past | C-8 / M-6 |
| 15 | `pack_size = 0` raises a validation error rather than booking zero | H-1 / H-2 |
| 16 | A split-batch Box sale preserves the Box unit on the sale line | H-3 |
| 17 | Approving more than requested is rejected | H-4 |
| 18 | A transfer into an existing lot number with a different expiry does not merge | H-5 |
| 19 | A transfer writes both movement-ledger entries | H-6 |
| 20 | A duplicate submission with the same idempotency token books once | M-1 |

### Suggested harness additions

- Extend `tests/Support/SeedsWestpoint.php` with a product whose `pack_size > 1` **and** a batch deliberately holding a non-multiple of it, so the C-2 class of defect is structurally reachable by any new test.
- Add a concurrency helper for tests 9 and 11 — these cannot be exercised by sequential requests.
- Add a `pack_size = 0` legacy-row fixture for test 15, since validation now prevents creating one through the UI.

---

## Appendix A — Conversion Call Sites

Authoritative list of every place Box→pieces conversion is performed or omitted.

| Location | Converts? | Fallback for `pack_size` | Status |
|---|---|---|---|
| `StockInController:63` | Yes | None | H-1 |
| `MedicineInventoryController:307` (`storeStock`) | Yes | None | H-1 |
| `MedicineInventoryController:347` (`updateBatch`) | Yes | None | C-2, H-1 |
| `PosController:414` (`store`) | Yes | None | H-2 |
| `PosController:696` (`piecesForCartLine`) | Yes | None | H-2 |
| **`StockOutController:81`** | **No** | — | **C-1** |
| `pricing.js:39` (`getPiecesRequired`) | Yes | `\|\| 1` | H-2 |
| `pricing.js:66` (`getMaxQuantity`) | Yes | `\|\| 1` | H-2 |
| `useStockIn.js:72` (preview) | Yes | `\|\| 1` | H-2 |
| `useAddStock.js:30` (preview) | Yes | `\|\| 1` | H-2 |
| `useEditBatch.js:17` (reverse) | Yes — **lossy** | `\|\| 1` | C-2 |
| **`useStockOut.js`** | **No** | — | **C-1** |

## Appendix B — Stock Mutation Paths and Ledger Coverage

| Path | Converts | Locks | Writes ledger | Re-checks stock |
|---|---|---|---|---|
| Stock In | Yes | n/a | Yes | n/a |
| Stock Out | **No** | Yes | Yes | Yes |
| POS checkout | Yes | Yes | No¹ | Yes |
| Add Stock | Yes | n/a | Yes | n/a |
| Edit Batch | Yes — lossy | No | Yes² | n/a |
| Transfer — source | n/a³ | **No** | **No** | **No** |
| Transfer — destination | n/a³ | **No** | **No** | n/a |

¹ POS records sales through `sale_items`, not the movement ledger — arguably by design, but it means the ledger is not a complete record of stock movement.
² Logs an absolute level rather than a delta (L-3).
³ Transfers move pieces directly and never expose a unit choice, so conversion does not apply. `pack_size` mismatch between branches is still a hazard (H-5).

---

*End of report. No source files were modified during this audit.*
