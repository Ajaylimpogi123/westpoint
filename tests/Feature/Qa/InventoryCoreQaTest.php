<?php

namespace Tests\Feature\Qa;

use App\Models\InventoryMovementLog;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\StockOut;
use App\Models\StockOutItem;
use App\Services\InventoryStockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * Project-wide QA pass: Medicine Inventory core (stock in/out, returns,
 * add stock, batch edit/delete, deactivate/restore, expiry command, ledger).
 *
 * test_bug_inv<N>_* tests are regression tests for confirmed defects and are
 * EXPECTED TO FAIL until the defect is fixed. All other tests document
 * verified behaviour and should pass.
 */
class InventoryCoreQaTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private function asSuperadminWithoutBranch()
    {
        return $this->actingAs($this->superadmin)
            ->withSession(['role_id' => 3, 'branch_id' => null]);
    }

    private function assertNoServerError(TestResponse $response): void
    {
        $this->assertLessThan(500, $response->status(), 'Server error: '.$response->getContent());
    }

    private function assertSucceeded(TestResponse $response): void
    {
        $this->assertNoServerError($response);
        $response->assertStatus(302);
        $response->assertSessionHasNoErrors();
        $this->assertNull(session('error'), 'Unexpected flash error: '.session('error'));
    }

    private function assertRejected(TestResponse $response): void
    {
        $this->assertNoServerError($response);

        if ($response->status() >= 400) {
            return;
        }

        $response->assertStatus(302);
        $errors = session('errors');
        $hasErrors = $errors && $errors->getBag('default')->isNotEmpty();
        $this->assertTrue($hasErrors || session('error') !== null, 'Expected the request to be rejected.');
    }

    private function logs()
    {
        return InventoryMovementLog::query()->orderBy('log_id')->get();
    }

    private function deliveryPayload(array $items, array $extra = []): array
    {
        return array_merge([
            'transaction_subtype' => 'Delivery to Customer',
            'branch_id' => $this->branchA->id,
            'issued_by' => 'QA Issuer',
            'delivered_to' => 'QA Clinic',
            'patient_reference' => 'Walk-in',
            'items' => $items,
        ], $extra);
    }

    private function line(int $quantity, string $unit = 'Piece', ?int $piecesPerBox = null, ?int $batchId = null): array
    {
        return array_filter([
            'pd_id' => $this->product->id,
            'products_qty_id' => $batchId ?? $this->batch->id,
            'quantity_deducted' => $quantity,
            'unit_type' => $unit,
            'pieces_per_box' => $piecesPerBox,
        ], fn ($value) => $value !== null);
    }

    // ==================================================================
    // CONFIRMED DEFECTS (expected to fail until fixed)
    // ==================================================================

    /**
     * INV-1 (fixed in qa-fix-batch-1): batch edit (stock adjustment) has no role gate on the server.
     * The UI hides it from staff (canEditMedicine), but a staff user can
     * PATCH the route directly and rewrite a batch's quantity.
     */
    public function test_inv1_staff_cannot_adjust_batch_quantity_directly(): void
    {
        $response = $this->actingAsWithSession($this->staff)
            ->patch(route('medicine-inventory.update-batch', $this->batch->id), [
                'lot_number' => 'LOT-001',
                'expiry' => $this->batch->expiry->format('Y-m-d'),
                'quantity_in_pieces' => 999_999,
                'adjustment_reason' => 'staff bypass',
            ]);

        $response->assertForbidden();
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    /** INV-1 (fixed in qa-fix-batch-1): batch delete has no role gate on the server. */
    public function test_inv1_staff_cannot_delete_batch_directly(): void
    {
        $response = $this->actingAsWithSession($this->staff)
            ->delete(route('medicine-inventory.destroy-batch', $this->batch->id));

        $response->assertForbidden();
        $this->assertSame(ProductQty::STATUS_ACTIVE, $this->batch->fresh()->status);
    }

    /**
     * INV-1 (fixed in qa-fix-batch-1): medicine deactivate has no role gate, while update/restore are
     * role:2,3 and the UI hides Delete from staff.
     */
    public function test_inv1_staff_cannot_deactivate_medicine_directly(): void
    {
        $response = $this->actingAsWithSession($this->staff)
            ->delete(route('medicine-inventory.destroy', $this->product->id));

        $response->assertForbidden();
        $this->assertSame('Active', $this->product->fresh()->status);
    }

    /**
     * INV-2 (fixed in qa-fix-batch-1): destroy() flips every Active batch to Inactive, and restore()
     * requires Active stock > 0, while Add Stock / Stock In refuse a Deleted
     * medicine. So a deactivated medicine that still holds stock can never be
     * restored through the UI, and its stock is stranded.
     */
    public function test_inv2_deactivated_medicine_with_stock_can_be_restored(): void
    {
        $this->actingAsWithSession($this->admin)
            ->delete(route('medicine-inventory.destroy', $this->product->id))
            ->assertRedirect();

        $this->assertSame('Deleted', $this->product->fresh()->status);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);

        $response = $this->actingAsWithSession($this->admin)
            ->patch(route('medicine-inventory.restore', $this->product->id));

        $this->assertNull(session('error'), 'Restore refused: '.session('error'));
        $this->assertSame('Active', $this->product->fresh()->status);
        $this->assertSame(100, InventoryStockService::dispensableStock($this->product->id));
    }

    /**
     * INV-4: deleting a batch logs +quantity, so the movement ledger shows a
     * green "+100" (stock added) for a removal. Every other row is a signed
     * delta (updateBatch comment: "matching every other row in the ledger");
     * a removal must not be logged as an addition.
     */
    public function test_bug_inv4_batch_delete_is_not_logged_as_stock_added(): void
    {
        $this->actingAsWithSession($this->admin)
            ->delete(route('medicine-inventory.destroy-batch', $this->batch->id))
            ->assertRedirect();

        $log = InventoryMovementLog::query()
            ->where('movement_type', InventoryMovementLog::TYPE_BATCH_DELETED)
            ->firstOrFail();

        $this->assertLessThanOrEqual(0, (int) $log->quantity, 'Batch deletion was logged as +'.$log->quantity.' pieces.');
    }

    // ==================================================================
    // VERIFIED BEHAVIOUR
    // ==================================================================

    /**
     * Formerly INV-3 (fixed by stock-out-validation-basket): per-lot
     * sufficiency is summed across basket lines for deliveries too.
     */
    public function test_delivery_rejects_lines_that_exceed_the_lot_in_aggregate(): void
    {
        $response = $this->actingAsWithSession($this->staff)
            ->post(route('stock-out.store'), $this->deliveryPayload([
                $this->line(60),
                $this->line(60),
            ], ['idempotency_key' => 'inv3-key']));

        $response->assertSessionHasErrors('items.1.quantity_deducted');
        $this->assertDatabaseCount('tbl_stock_outs', 0);
        $this->assertDatabaseMissing('tbl_idempotency_keys', ['idempotency_key' => 'inv3-key']);
    }

    public function test_delivery_edit_rejects_lines_that_exceed_the_lot_in_aggregate(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post(route('stock-out.store'), $this->deliveryPayload([$this->line(10)]))
            ->assertSessionHasNoErrors();

        $stockOut = StockOut::firstOrFail();

        $response = $this->actingAsWithSession($this->staff)
            ->put(route('stock-out.update', $stockOut->stock_out_id), [
                'issued_by' => 'QA Issuer',
                'delivered_to' => 'QA Clinic',
                'items' => [$this->line(70), $this->line(70)],
            ]);

        $response->assertSessionHasErrors('items.1.quantity_deducted');
        $this->assertSame(10, (int) StockOutItem::sum('pieces_deducted'));
    }

    /**
     * A pending Box delivery recorded before pieces_per_box existed (NULL)
     * comes back from edit with pieces_per_box null; resubmitting it is a
     * recoverable line error (the basket row has an editable pcs/box input),
     * and supplying the value saves without touching stock.
     */
    public function test_legacy_box_delivery_without_pieces_per_box_is_a_fixable_line_error_on_edit(): void
    {
        $stockOut = StockOut::create([
            'transaction_subtype' => 'Delivery to Customer',
            'branch_id' => $this->branchA->id,
            'issued_by' => 'Legacy',
            'delivered_to' => 'QA Clinic',
        ]);

        StockOutItem::create([
            'stock_out_id' => $stockOut->stock_out_id,
            'pd_id' => $this->product->id,
            'products_qty_id' => $this->batch->id,
            'lot_number' => 'LOT-001',
            'quantity_deducted' => 2,
            'pieces_deducted' => 20,
            'expiry' => $this->batch->expiry,
            'unit_type' => 'Box',
            'pieces_per_box' => null,
        ]);

        $edit = $this->actingAsWithSession($this->staff)
            ->getJson(route('stock-out.edit', $stockOut->stock_out_id))
            ->assertOk()
            ->json();

        $items = collect($edit['items'])->map(fn ($item) => [
            'pd_id' => $item['pd_id'],
            'products_qty_id' => $item['products_qty_id'],
            'quantity_deducted' => $item['quantity_deducted'],
            'unit_type' => $item['unit_type'],
            'pieces_per_box' => $item['pieces_per_box'],
        ])->all();

        $payload = ['issued_by' => 'Legacy edited', 'delivered_to' => 'QA Clinic', 'items' => $items];

        $this->actingAsWithSession($this->staff)
            ->put(route('stock-out.update', $stockOut->stock_out_id), $payload)
            ->assertSessionHasErrors('items.0.pieces_per_box');

        $payload['items'][0]['pieces_per_box'] = 10;
        $this->assertSucceeded($this->actingAsWithSession($this->staff)
            ->put(route('stock-out.update', $stockOut->stock_out_id), $payload));

        $this->assertSame('Legacy edited', $stockOut->fresh()->issued_by);
        $this->assertSame(20, (int) StockOutItem::sum('pieces_deducted'));
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(0, InventoryMovementLog::count());
    }

    /**
     * Ledger invariant: across stock in (Box), add stock (Box), customer
     * return (Piece) and return-to-supplier (Box with pieces_per_box), the
     * sum of logged quantities equals the change in products_qty, every log
     * is in pieces, and every log carries the medicine's branch (B) even
     * though the admin's session is branch A.
     */
    public function test_ledger_matches_stock_changes_in_pieces_and_branch_for_cross_branch_admin(): void
    {
        $productB = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Cetirizine',
            'dose' => '10mg',
            'form' => 'Tablet',
            'pack_size' => 12,
            'retail_price' => 3,
            'wholesale_price' => 30,
            'status' => 'Active',
        ]);
        $customerB = \App\Models\BranchCustomer::create([
            'branch_id' => $this->branchB->id,
            'first_name' => 'Ben',
            'last_name' => 'Bravo',
            'customer_type' => 'Regular',
            'status' => 'active',
        ]);

        $expiry = now()->addYears(2)->toDateString();
        $admin = $this->actingAsWithSession($this->admin);

        // Stock in 3 boxes = 36 pieces.
        $this->assertSucceeded($admin->post(route('stock-in.store'), [
            'idempotency_key' => 'ledger-in',
            'supplier_name' => 'Acme',
            'delivery_date' => now()->toDateString(),
            'branch_id' => $this->branchB->id,
            'received_by' => 'QA',
            'items' => [[
                'pd_id' => $productB->id,
                'batch_number' => 'L-B',
                'expiry_date' => $expiry,
                'quantity_received' => 3,
                'unit_type' => 'Box',
            ]],
        ]));

        // Add stock 2 boxes into the same lot/expiry = +24 (merged).
        $this->assertSucceeded($this->actingAsWithSession($this->admin)->post(route('medicine-inventory.store-stock'), [
            'product_id' => $productB->id,
            'boxes_received' => 2,
            'unit_type' => 'Box',
            'lot_number' => 'L-B',
            'expiry' => $expiry,
        ]));

        // Customer return 5 pieces into the same lot = +5.
        $this->assertSucceeded($this->actingAsWithSession($this->admin)->post(route('customer-return.store'), [
            'idempotency_key' => 'ledger-ret',
            'customer_id' => $customerB->customer_id,
            'return_date' => now()->toDateString(),
            'branch_id' => $this->branchB->id,
            'received_by' => 'QA',
            'items' => [[
                'pd_id' => $productB->id,
                'batch_number' => 'L-B',
                'expiry_date' => $expiry,
                'quantity_received' => 5,
                'unit_type' => 'Piece',
            ]],
        ]));

        $batch = ProductQty::where('product_id', $productB->id)->firstOrFail();
        $this->assertSame(1, ProductQty::where('product_id', $productB->id)->count(), 'Lines with same lot/expiry/shelf should merge');
        $this->assertSame(65, (int) $batch->quantity);

        // Return to supplier 2 boxes of 12 = -24.
        $this->assertSucceeded($this->actingAsWithSession($this->admin)->post(route('stock-out.store'), [
            'idempotency_key' => 'ledger-out',
            'transaction_subtype' => 'Returned to supplier',
            'branch_id' => $this->branchB->id,
            'issued_by' => 'QA',
            'items' => [[
                'pd_id' => $productB->id,
                'products_qty_id' => $batch->id,
                'quantity_deducted' => 2,
                'unit_type' => 'Box',
                'pieces_per_box' => 12,
            ]],
        ]));

        $this->assertSame(41, (int) $batch->fresh()->quantity);

        $logs = InventoryMovementLog::where('pd_id', $productB->id)
            ->whereIn('movement_type', [
                InventoryMovementLog::TYPE_STOCK_IN,
                InventoryMovementLog::TYPE_ADD_STOCK,
                InventoryMovementLog::TYPE_CUSTOMER_RETURN,
                InventoryMovementLog::TYPE_STOCK_OUT,
            ])->get();

        $this->assertCount(4, $logs);
        $this->assertSame(41, (int) $logs->sum('quantity'));
        $this->assertSame([36, 24, 5, -24], $logs->sortBy('log_id')->pluck('quantity')->map(fn ($q) => (int) $q)->values()->all());
        $this->assertTrue($logs->every(fn ($log) => (int) $log->branch_id === $this->branchB->id), 'Every log must carry branch B');
        $this->assertSame(0, InventoryMovementLog::where('branch_id', $this->branchA->id)->count());
    }

    public function test_delivery_to_customer_defers_deduction_until_confirm_and_confirms_once(): void
    {
        $this->assertSucceeded($this->actingAsWithSession($this->staff)
            ->post(route('stock-out.store'), $this->deliveryPayload([$this->line(3, 'Box', 10)], ['idempotency_key' => 'd1'])));

        $stockOut = StockOut::firstOrFail();
        $this->assertSame(100, (int) $this->batch->fresh()->quantity, 'Delivery must not deduct before confirm');
        $this->assertSame(0, InventoryMovementLog::count(), 'No stock change, so no log');

        $this->assertSucceeded($this->actingAsWithSession($this->staff)
            ->post(route('stock-out.confirm-delivery', $stockOut->stock_out_id)));

        $this->assertSame(70, (int) $this->batch->fresh()->quantity);
        $this->assertSame(1, InventoryMovementLog::count());
        $this->assertSame(-30, (int) InventoryMovementLog::first()->quantity);
        $this->assertSame($this->branchA->id, (int) InventoryMovementLog::first()->branch_id);
        $this->assertSame(1, DB::table('tbl_sales')->count());

        // Second confirm is refused and changes nothing.
        $this->actingAsWithSession($this->staff)
            ->post(route('stock-out.confirm-delivery', $stockOut->stock_out_id));
        $this->assertNotNull(session('error'));
        $this->assertSame(70, (int) $this->batch->fresh()->quantity);
        $this->assertSame(1, InventoryMovementLog::count());
        $this->assertSame(1, DB::table('tbl_sales')->count());
    }

    public function test_stock_out_edit_replaces_lines_without_touching_stock_or_ledger(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post(route('stock-out.store'), $this->deliveryPayload([$this->line(10)]));
        $stockOut = StockOut::firstOrFail();

        $this->assertSucceeded($this->actingAsWithSession($this->staff)
            ->put(route('stock-out.update', $stockOut->stock_out_id), [
                'issued_by' => 'QA Issuer',
                'delivered_to' => 'QA Clinic',
                'items' => [$this->line(4, 'Box', 10)],
            ]));

        $this->assertSame(1, StockOutItem::count());
        $this->assertSame(40, (int) StockOutItem::first()->pieces_deducted);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(0, InventoryMovementLog::count());
    }

    public function test_stock_in_business_error_releases_key_and_same_key_retry_posts_once(): void
    {
        $payload = [
            'idempotency_key' => 'conflict-key',
            'supplier_name' => 'Acme',
            'delivery_date' => now()->toDateString(),
            'branch_id' => $this->branchA->id,
            'received_by' => 'QA',
            'items' => [[
                'pd_id' => $this->product->id,
                // Same lot as the seeded batch, different expiry => conflict.
                'batch_number' => 'LOT-001',
                'expiry_date' => now()->addYears(3)->toDateString(),
                'quantity_received' => 2,
                'unit_type' => 'Box',
            ]],
        ];

        $first = $this->actingAsWithSession($this->staff)->post(route('stock-in.store'), $payload);
        $this->assertNoServerError($first);
        $this->assertNotNull(session('error'));
        $this->assertDatabaseCount('tbl_stock_ins', 0);
        $this->assertDatabaseCount('tbl_inventory_movement_logs', 0);
        $this->assertDatabaseMissing('tbl_idempotency_keys', ['idempotency_key' => 'conflict-key']);

        $payload['items'][0]['confirm_duplicate_lot'] = true;
        $this->assertSucceeded($this->actingAsWithSession($this->staff)->post(route('stock-in.store'), $payload));
        $this->actingAsWithSession($this->staff)->post(route('stock-in.store'), $payload);

        $this->assertDatabaseCount('tbl_stock_ins', 1);
        $this->assertSame(120, (int) ProductQty::where('product_id', $this->product->id)->sum('quantity'));
        $this->assertSame(1, InventoryMovementLog::count());
        $this->assertSame(20, (int) InventoryMovementLog::first()->quantity);
    }

    public function test_add_stock_never_merges_into_expired_or_deleted_batch(): void
    {
        $expiry = now()->addMonths(6)->toDateString();

        $expired = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 7,
            'status' => ProductQty::STATUS_EXPIRED,
            'lot_number' => 'LOCK-1',
            'expiry' => $expiry,
        ]);
        $deleted = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 9,
            'status' => ProductQty::STATUS_DELETED,
            'lot_number' => 'LOCK-2',
            'expiry' => $expiry,
        ]);

        foreach (['LOCK-1', 'LOCK-2'] as $lot) {
            $this->assertSucceeded($this->actingAsWithSession($this->staff)->post(route('medicine-inventory.store-stock'), [
                'product_id' => $this->product->id,
                'boxes_received' => 1,
                'unit_type' => 'Box',
                'lot_number' => $lot,
                'expiry' => $expiry,
            ]));
        }

        $this->assertSame(7, (int) $expired->fresh()->quantity);
        $this->assertSame(ProductQty::STATUS_EXPIRED, $expired->fresh()->status);
        $this->assertSame(9, (int) $deleted->fresh()->quantity);
        $this->assertSame(ProductQty::STATUS_DELETED, $deleted->fresh()->status);
        $this->assertSame(2, ProductQty::where('status', ProductQty::STATUS_ACTIVE)->where('quantity', 10)->count());
    }

    public function test_batch_adjustment_keeps_expired_lock_and_logs_signed_delta(): void
    {
        $this->batch->update(['status' => ProductQty::STATUS_EXPIRED]);

        $this->assertSucceeded($this->actingAsWithSession($this->admin)
            ->patch(route('medicine-inventory.update-batch', $this->batch->id), [
                'lot_number' => 'LOT-001',
                'expiry' => $this->batch->expiry->format('Y-m-d'),
                'quantity_in_pieces' => 40,
                'adjustment_reason' => 'Count correction',
            ]));

        $this->assertSame(40, (int) $this->batch->fresh()->quantity);
        $this->assertSame(ProductQty::STATUS_EXPIRED, $this->batch->fresh()->status);

        $log = InventoryMovementLog::firstOrFail();
        $this->assertSame(InventoryMovementLog::TYPE_BATCH_UPDATED, $log->movement_type);
        $this->assertSame(-60, (int) $log->quantity);
        $this->assertSame($this->branchA->id, (int) $log->branch_id);
    }

    public function test_batch_adjustment_to_zero_marks_active_batch_inactive(): void
    {
        $this->assertSucceeded($this->actingAsWithSession($this->admin)
            ->patch(route('medicine-inventory.update-batch', $this->batch->id), [
                'lot_number' => 'LOT-001',
                'expiry' => $this->batch->expiry->format('Y-m-d'),
                'quantity_in_pieces' => 0,
                'adjustment_reason' => 'Damaged',
            ]));

        $this->assertSame(ProductQty::STATUS_INACTIVE, $this->batch->fresh()->status);
        $this->assertSame(-100, (int) InventoryMovementLog::firstOrFail()->quantity);
    }

    public function test_batch_adjustment_validation_rejects_negative_over_limit_and_missing_reason(): void
    {
        foreach ([
            ['quantity_in_pieces' => -1, 'adjustment_reason' => 'x'],
            ['quantity_in_pieces' => InventoryStockService::MAX_TRANSACTION_QUANTITY + 1, 'adjustment_reason' => 'x'],
            ['quantity_in_pieces' => 50],
        ] as $payload) {
            $response = $this->actingAsWithSession($this->admin)
                ->patch(route('medicine-inventory.update-batch', $this->batch->id), $payload);
            $response->assertSessionHasErrors();
        }

        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(0, InventoryMovementLog::count());
    }

    public function test_add_stock_quantity_and_expiry_validation(): void
    {
        foreach ([
            ['boxes_received' => 0],
            ['boxes_received' => -3],
            ['boxes_received' => InventoryStockService::MAX_TRANSACTION_QUANTITY + 1],
            ['boxes_received' => 1, 'expiry' => now()->subDay()->toDateString()],
            ['boxes_received' => 1, 'unit_type' => 'Crate'],
        ] as $payload) {
            $this->actingAsWithSession($this->staff)
                ->post(route('medicine-inventory.store-stock'), ['product_id' => $this->product->id] + $payload)
                ->assertSessionHasErrors();
        }

        $this->assertSame(1, ProductQty::count());
        $this->assertSame(0, InventoryMovementLog::count());
    }

    public function test_add_stock_box_on_medicine_without_pack_size_is_refused_without_writes(): void
    {
        // pack_size is NOT NULL and chk_pack_size_min (migration 45) rejects 0.
        // That CHECK is only advisory on MySQL < 8.0.16, so the application
        // guard must still hold: plant the bad row with the check switched
        // off for this session only (MariaDB; no DDL, so RefreshDatabase
        // keeps its transaction).
        try {
            DB::statement('SET SESSION check_constraint_checks = 0');
        } catch (\Illuminate\Database\QueryException) {
            // MySQL has no such switch; there the CHECK (8.0.16+) makes a
            // zero pack size impossible to store at all.
            $this->markTestSkipped('Cannot plant pack_size = 0 on this server; the DB invariant enforces it.');
        }

        try {
            DB::table('tbl_products')->where('id', $this->product->id)->update(['pack_size' => 0]);
        } finally {
            DB::statement('SET SESSION check_constraint_checks = 1');
        }
        $this->assertSame(0, (int) DB::table('tbl_products')->where('id', $this->product->id)->value('pack_size'));

        $response = $this->actingAsWithSession($this->staff)->post(route('medicine-inventory.store-stock'), [
            'product_id' => $this->product->id,
            'boxes_received' => 2,
            'unit_type' => 'Box',
            'lot_number' => 'NP-1',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $this->assertNoServerError($response);
        $this->assertNotNull(session('error'));
        $this->assertSame(1, ProductQty::count());
        $this->assertSame(0, InventoryMovementLog::count());
    }

    public function test_add_stock_by_admin_lands_in_medicine_branch_in_pieces(): void
    {
        $productB = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Losartan',
            'pack_size' => 30,
            'retail_price' => 2,
            'wholesale_price' => 50,
            'status' => 'Active',
        ]);

        $this->assertSucceeded($this->asSuperadminWithoutBranch()->post(route('medicine-inventory.store-stock'), [
            'product_id' => $productB->id,
            'boxes_received' => 2,
            'unit_type' => 'Box',
            'lot_number' => 'LS-1',
            'expiry' => now()->addYear()->toDateString(),
        ]));

        $this->assertSame(60, (int) ProductQty::where('product_id', $productB->id)->sum('quantity'));
        $log = InventoryMovementLog::firstOrFail();
        $this->assertSame($this->branchB->id, (int) $log->branch_id);
        $this->assertSame(60, (int) $log->quantity);
    }

    public function test_expire_batches_command_locks_lapsed_batches_logs_once_and_dry_run_is_readonly(): void
    {
        $this->batch->update(['expiry' => now()->subDay()->toDateString()]);
        $emptyLapsed = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 0,
            'status' => ProductQty::STATUS_INACTIVE,
            'lot_number' => 'EMPTY',
            'expiry' => now()->subDays(3)->toDateString(),
        ]);
        $fresh = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 5,
            'status' => ProductQty::STATUS_ACTIVE,
            'lot_number' => 'FRESH',
            'expiry' => now()->toDateString(), // expires today: still dispensable
        ]);

        $this->artisan('inventory:expire-batches', ['--dry-run' => true])->assertSuccessful();
        $this->assertSame(ProductQty::STATUS_ACTIVE, $this->batch->fresh()->status);
        $this->assertSame(0, InventoryMovementLog::count());

        $this->artisan('inventory:expire-batches')->assertSuccessful();
        $this->artisan('inventory:expire-batches')->assertSuccessful();

        $this->assertSame(ProductQty::STATUS_EXPIRED, $this->batch->fresh()->status);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(ProductQty::STATUS_EXPIRED, $emptyLapsed->fresh()->status);
        $this->assertSame(ProductQty::STATUS_ACTIVE, $fresh->fresh()->status);

        $this->assertSame(1, InventoryMovementLog::count(), 'Only the stranded batch is logged, once');
        $log = InventoryMovementLog::first();
        $this->assertSame(InventoryMovementLog::TYPE_BATCH_EXPIRED, $log->movement_type);
        $this->assertSame($this->branchA->id, (int) $log->branch_id);
        $this->assertSame(0, (int) $log->quantity);

        // Only the batch expiring today remains dispensable.
        $this->assertSame(5, InventoryStockService::dispensableStock($this->product->id));
    }

    public function test_fefo_deducts_earliest_expiry_first_skips_lapsed_and_puts_null_expiry_last(): void
    {
        $this->batch->update(['expiry' => now()->addMonths(10)->toDateString()]); // LOT-001: 100
        $early = ProductQty::create(['product_id' => $this->product->id, 'quantity' => 15, 'status' => 'Active', 'lot_number' => 'EARLY', 'expiry' => now()->addMonth()->toDateString()]);
        $lapsed = ProductQty::create(['product_id' => $this->product->id, 'quantity' => 50, 'status' => 'Active', 'lot_number' => 'LAPSED', 'expiry' => now()->subDay()->toDateString()]);
        $noExpiry = ProductQty::create(['product_id' => $this->product->id, 'quantity' => 30, 'status' => 'Active', 'lot_number' => 'NOEXP', 'expiry' => null]);

        $deductions = DB::transaction(fn () => InventoryStockService::deductFefo($this->product->id, 120, 'Paracetamol'));

        $this->assertSame([
            ['batch_id' => $early->id, 'pieces' => 15],
            ['batch_id' => $this->batch->id, 'pieces' => 100],
            ['batch_id' => $noExpiry->id, 'pieces' => 5],
        ], $deductions);
        $this->assertSame(50, (int) $lapsed->fresh()->quantity);
        $this->assertSame(ProductQty::STATUS_INACTIVE, $early->fresh()->status);

        $this->expectException(\App\Exceptions\InsufficientStockException::class);
        DB::transaction(fn () => InventoryStockService::deductFefo($this->product->id, 26, 'Paracetamol'));
    }

    public function test_return_to_supplier_box_without_pieces_per_box_is_refused_and_key_released(): void
    {
        $response = $this->actingAsWithSession($this->staff)->post(route('stock-out.store'), [
            'idempotency_key' => 'nopcs',
            'transaction_subtype' => 'Returned to supplier',
            'branch_id' => $this->branchA->id,
            'issued_by' => 'QA',
            'items' => [$this->line(2, 'Box')],
        ]);

        $this->assertNoServerError($response);
        // stock-out-validation-basket: now a line validation error, not a flash error.
        $response->assertSessionHasErrors('items.0.pieces_per_box');
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertDatabaseCount('tbl_stock_outs', 0);
        $this->assertDatabaseMissing('tbl_idempotency_keys', ['idempotency_key' => 'nopcs']);
    }

    public function test_return_to_supplier_over_two_lines_on_same_lot_is_all_or_nothing(): void
    {
        $response = $this->actingAsWithSession($this->staff)->post(route('stock-out.store'), [
            'idempotency_key' => 'two-lines',
            'transaction_subtype' => 'Returned to supplier',
            'branch_id' => $this->branchA->id,
            'issued_by' => 'QA',
            'items' => [$this->line(60), $this->line(60)],
        ]);

        $this->assertNoServerError($response);
        // stock-out-validation-basket: now a line validation error, not a flash error.
        $response->assertSessionHasErrors('items.1.quantity_deducted');
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertDatabaseCount('tbl_stock_outs', 0);
        $this->assertSame(0, InventoryMovementLog::count());
    }

    public function test_staff_cannot_restore_or_update_medicine_and_staff_add_stock_scoped_to_own_branch(): void
    {
        $this->actingAsWithSession($this->staff)
            ->patch(route('medicine-inventory.restore', $this->product->id))
            ->assertForbidden();

        $productB = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Metformin',
            'pack_size' => 10,
            'retail_price' => 1,
            'wholesale_price' => 9,
            'status' => 'Active',
        ]);
        $batchB = ProductQty::create(['product_id' => $productB->id, 'quantity' => 10, 'status' => 'Active', 'lot_number' => 'MB']);

        $this->actingAsWithSession($this->staff)
            ->patch(route('medicine-inventory.update-batch', $batchB->id), [
                'quantity_in_pieces' => 1, 'adjustment_reason' => 'x',
            ])->assertForbidden();
        $this->actingAsWithSession($this->staff)
            ->delete(route('medicine-inventory.destroy-batch', $batchB->id))
            ->assertForbidden();

        $this->assertSame(10, (int) $batchB->fresh()->quantity);
        $this->assertSame('Active', $batchB->fresh()->status);
    }
}
