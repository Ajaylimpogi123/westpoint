<?php

namespace Tests\Feature\Qa;

use App\Models\Branch;
use App\Models\InventoryMovementLog;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route as RouteFacade;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * QA pass: Stock Transfer module and access control across the app.
 *
 * test_bug_* tests document confirmed defects and are expected to FAIL until
 * the product code is fixed. Every other test documents verified behaviour.
 */
class TransferAccessQaTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    // ── Helpers ─────────────────────────────────────────

    private function transferPayload(int $qty, array $overrides = [], ?int $lotId = null): array
    {
        return array_merge([
            'to_branch_id' => $this->branchB->id,
            'priority' => 'normal',
            'transfer_date' => now()->toDateString(),
            'items' => [[
                'product_id' => $this->product->id,
                'products_qty_id' => $lotId ?? $this->batch->id,
                'quantity_requested' => $qty,
            ]],
        ], $overrides);
    }

    /** Staff in branch A requests $qty pieces of LOT-001 to branch B, over HTTP. */
    private function requestTransfer(int $qty = 10, ?User $as = null): StockTransfer
    {
        $this->actingAsWithSession($as ?? $this->staff)
            ->post('/stock-transfers', $this->transferPayload($qty))
            ->assertSessionHasNoErrors();

        return StockTransfer::latest('id')->firstOrFail();
    }

    /** Pending transfer written straight to the DB, for list/notification tests. */
    private function makePendingTransfer(int $n, string $status = 'pending', ?int $requestedBy = null): StockTransfer
    {
        $transfer = StockTransfer::create([
            'transfer_no' => sprintf('TR-QA-%05d', $n),
            'from_branch_id' => $this->branchA->id,
            'to_branch_id' => $this->branchB->id,
            'requested_by' => $requestedBy ?? $this->staff->id,
            'status' => $status,
            'priority' => 'normal',
            'transfer_date' => now()->toDateString(),
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $this->product->id,
            'products_qty_id' => $this->batch->id,
            'lot_number' => 'LOT-001',
            'expiry' => $this->batch->expiry,
            'quantity_requested' => 1,
        ]);

        return $transfer;
    }

    private function branchBStock(): int
    {
        return (int) ProductQty::query()
            ->whereHas('product', fn ($q) => $q->where('branch_id', $this->branchB->id))
            ->sum('quantity');
    }

    private function branchBCopy(array $overrides = []): MedicineProduct
    {
        return MedicineProduct::create(array_merge([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Paracetamol',
            'dose' => '500mg',
            'form' => 'Tablet',
            'pack_size' => 10,
            'brand_name' => 'Bioflu',
            'retail_price' => 5.00,
            'wholesale_price' => 45.00,
            'status' => 'Active',
            'is_generic' => false,
        ], $overrides));
    }

    private function makeUser(int $roleId, ?int $branchId, string $email): User
    {
        return User::create([
            'name' => "User {$email}",
            'email' => $email,
            'password' => Hash::make('password'),
            'role_id' => $roleId,
            'branch_id' => $branchId,
            'email_verified_at' => now(),
        ]);
    }

    // =====================================================================
    // STOCK TRANSFER: confirmed defects
    // =====================================================================

    /**
     * TRF-1. Branch B has a deactivated ("Deleted") copy of the medicine.
     * resolveDestinationProduct() does not filter by status, so the received
     * stock is booked under the deactivated product, where POS and the
     * inventory list don't offer it.
     */
    public function test_bug_trf1_approval_books_stock_into_a_deactivated_destination_medicine(): void
    {
        $deactivated = $this->branchBCopy(['status' => 'Deleted']);
        $transfer = $this->requestTransfer(10);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve");

        if ((int) $this->batch->fresh()->quantity === 100) {
            // Refusing the approval is an acceptable outcome.
            $this->assertSame('pending', $transfer->fresh()->status);

            return;
        }

        $received = ProductQty::query()
            ->whereHas('product', fn ($q) => $q->where('branch_id', $this->branchB->id))
            ->where('quantity', '>', 0)
            ->with('product')
            ->get();

        $this->assertCount(1, $received);
        $this->assertSame(
            'Active',
            $received->first()->product->status,
            "Received stock was booked under product #{$received->first()->product_id} "
            ."(status {$received->first()->product->status}); deactivated copy is #{$deactivated->id}.",
        );
    }

    /**
     * TRF-2 (fixed in qa-fix-batch-1). The medicine is deactivated (DELETE /medicine-inventory/{id},
     * which sets its batches to Inactive) while a request is pending. Approval
     * still ships the stock and deductFromBatch() flips the source batch from
     * Inactive back to Active.
     */
    public function test_trf2_approval_refuses_a_medicine_deactivated_after_the_request(): void
    {
        $transfer = $this->requestTransfer(10);

        $this->actingAsWithSession($this->admin)
            ->delete("/medicine-inventory/{$this->product->id}")
            ->assertRedirect();

        $this->assertSame('Deleted', $this->product->fresh()->status);
        $this->assertSame('Inactive', $this->batch->fresh()->status);

        $response = $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve");

        $this->assertSame('Inactive', $this->batch->fresh()->status, 'Approval reactivated the deactivated source batch.');
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame('pending', $transfer->fresh()->status);
        $this->assertSame(0, $this->branchBStock());
        $response->assertSessionHasErrors('status');
    }

    /**
     * TRF-3. The destination branch is deleted while a request is pending.
     * Approval moves the stock into the soft-deleted branch.
     */
    public function test_bug_trf3_approval_moves_stock_into_a_deleted_destination_branch(): void
    {
        $transfer = $this->requestTransfer(10);

        $this->actingAsWithSession($this->superadmin)
            ->delete("/branch-management/{$this->branchB->id}")
            ->assertRedirect();
        $this->assertSoftDeleted('branches', ['id' => $this->branchB->id]);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasErrors('status');

        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(0, $this->branchBStock());
    }

    /**
     * TRF-4. products_qty.lot_number is nullable (stock can be added without a
     * lot number), but tbl_stock_transfer_items.lot_number is NOT NULL. A
     * request for such a lot is a 500 instead of a validation error.
     */
    public function test_bug_trf4_requesting_a_lot_without_lot_number_crashes(): void
    {
        $noLot = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 30,
            'status' => 'Active',
            'lot_number' => null,
            'expiry' => now()->addMonths(6)->toDateString(),
        ]);

        $response = $this->actingAsWithSession($this->staff)
            ->post('/stock-transfers', $this->transferPayload(5, [], $noLot->id));

        $this->assertNotSame(500, $response->status(), 'Transfer request for a lot with no lot number returned 500.');
    }

    /**
     * TRF-5. products_qty.lot_number allows 100 characters (stock-in and batch
     * edit validate max:100), but tbl_stock_transfer_items.lot_number is
     * varchar(50). A lot number of 51-100 characters crashes the request.
     */
    public function test_bug_trf5_requesting_a_lot_with_a_long_lot_number_crashes(): void
    {
        $longLot = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 30,
            'status' => 'Active',
            'lot_number' => str_repeat('L', 60),
            'expiry' => now()->addMonths(6)->toDateString(),
        ]);

        $response = $this->actingAsWithSession($this->staff)
            ->post('/stock-transfers', $this->transferPayload(5, [], $longLot->id));

        $this->assertNotSame(500, $response->status(), 'Transfer request for a 60-char lot number returned 500.');
    }

    // =====================================================================
    // STOCK TRANSFER: verified behaviour
    // =====================================================================

    public function test_partial_approval_moves_only_the_approved_quantity_and_logs_it(): void
    {
        $transfer = $this->requestTransfer(30);
        $item = $transfer->items()->firstOrFail();

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve", [
                'approved_quantities' => [$item->id => 12],
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame('approved', $transfer->fresh()->status);
        $this->assertSame(12, (int) $item->fresh()->quantity_approved);
        $this->assertSame(88, (int) $this->batch->fresh()->quantity);
        $this->assertSame(12, $this->branchBStock());
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'movement_type' => InventoryMovementLog::TYPE_TRANSFER_OUT,
            'branch_id' => $this->branchA->id,
            'reference_id' => $transfer->id,
            'quantity' => -12,
        ]);
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'movement_type' => InventoryMovementLog::TYPE_TRANSFER_IN,
            'branch_id' => $this->branchB->id,
            'reference_id' => $transfer->id,
            'quantity' => 12,
        ]);
    }

    public function test_partial_approval_rejects_over_zero_and_foreign_lines(): void
    {
        $transfer = $this->requestTransfer(30);
        $item = $transfer->items()->firstOrFail();
        $other = $this->makePendingTransfer(900);
        $otherItem = $other->items()->firstOrFail();

        foreach ([
            'more than requested' => [$item->id => 31],
            'zero' => [$item->id => 0],
            'negative' => [$item->id => -5],
            'non-integer' => [$item->id => '2.5'],
            'line of another transfer' => [$otherItem->id => 1],
            'unknown line' => [999999 => 1],
        ] as $case => $quantities) {
            $this->actingAsWithSession($this->admin)
                ->post("/stock-transfers/{$transfer->id}/approve", ['approved_quantities' => $quantities])
                ->assertSessionHasErrors();

            $this->assertSame('pending', $transfer->fresh()->status, $case);
            $this->assertSame(100, (int) $this->batch->fresh()->quantity, $case);
        }

        $this->assertNull($item->fresh()->quantity_approved);
        $this->assertSame(0, $this->branchBStock());
    }

    public function test_two_pending_requests_sharing_a_lot_cannot_both_be_approved(): void
    {
        $first = $this->requestTransfer(60);
        $second = $this->requestTransfer(60);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$first->id}/approve")
            ->assertSessionHasNoErrors();

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$second->id}/approve")
            ->assertSessionHasErrors('status');

        $this->assertSame('approved', $first->fresh()->status);
        $this->assertSame('pending', $second->fresh()->status);
        $this->assertSame(40, (int) $this->batch->fresh()->quantity);
        $this->assertSame(60, $this->branchBStock());
        $this->assertSame(0, InventoryMovementLog::query()->where('reference_id', $second->id)
            ->whereIn('movement_type', [InventoryMovementLog::TYPE_TRANSFER_OUT, InventoryMovementLog::TYPE_TRANSFER_IN])
            ->count());
        $this->assertSame(0, (int) $second->logs()->where('action', 'approved')->count());
    }

    public function test_approval_merges_into_matching_destination_lot(): void
    {
        $dest = $this->branchBCopy();
        $destLot = ProductQty::create([
            'product_id' => $dest->id,
            'quantity' => 5,
            'status' => 'Active',
            'lot_number' => 'LOT-001',
            'expiry' => $this->batch->expiry->toDateString(),
        ]);

        $transfer = $this->requestTransfer(10);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasNoErrors();

        $this->assertSame(15, (int) $destLot->fresh()->quantity);
        $this->assertSame(1, ProductQty::where('product_id', $dest->id)->count());
        $this->assertSame(1, MedicineProduct::where('branch_id', $this->branchB->id)->count());
    }

    public function test_approval_does_not_merge_into_same_lot_with_different_expiry(): void
    {
        $dest = $this->branchBCopy();
        $destLot = ProductQty::create([
            'product_id' => $dest->id,
            'quantity' => 5,
            'status' => 'Active',
            'lot_number' => 'LOT-001',
            'expiry' => now()->addMonths(3)->toDateString(),
        ]);

        $transfer = $this->requestTransfer(10);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasNoErrors();

        $this->assertSame(5, (int) $destLot->fresh()->quantity);
        $newLot = ProductQty::where('product_id', $dest->id)->whereKeyNot($destLot->id)->firstOrFail();
        $this->assertSame(10, (int) $newLot->quantity);
        $this->assertSame($this->batch->expiry->toDateString(), $newLot->expiry->toDateString());
    }

    public function test_destination_product_is_matched_case_and_whitespace_insensitively(): void
    {
        $dest = $this->branchBCopy([
            'med_name' => '  paracetamol ',
            'dose' => '500MG',
            'form' => 'tablet',
            'brand_name' => 'BIOFLU',
        ]);

        $transfer = $this->requestTransfer(10);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasNoErrors();

        $this->assertSame(1, MedicineProduct::where('branch_id', $this->branchB->id)->count());
        $this->assertSame(10, (int) ProductQty::where('product_id', $dest->id)->sum('quantity'));
    }

    public function test_destination_pack_size_mismatch_refuses_approval(): void
    {
        $this->branchBCopy(['pack_size' => 12]);
        $transfer = $this->requestTransfer(10);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasErrors('status');

        $this->assertSame('pending', $transfer->fresh()->status);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(0, $this->branchBStock());
    }

    public function test_new_destination_product_copies_pack_size(): void
    {
        $transfer = $this->requestTransfer(25);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasNoErrors();

        $dest = MedicineProduct::where('branch_id', $this->branchB->id)->firstOrFail();
        $this->assertSame(10, (int) $dest->pack_size);
        $this->assertSame('Active', $dest->status);
        $this->assertSame(25, (int) ProductQty::where('product_id', $dest->id)->sum('quantity'));
    }

    public function test_approval_refuses_a_lot_deleted_after_the_request(): void
    {
        $transfer = $this->requestTransfer(10);

        $this->actingAsWithSession($this->admin)
            ->delete("/medicine-inventory/batch/{$this->batch->id}")
            ->assertRedirect();

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasErrors('status');

        $this->assertSame('pending', $transfer->fresh()->status);
        $this->assertSame(0, $this->branchBStock());
    }

    public function test_request_rejects_zero_negative_over_limit_and_insufficient_quantities(): void
    {
        foreach ([0, -1, 1_000_001] as $qty) {
            $this->actingAsWithSession($this->staff)
                ->post('/stock-transfers', $this->transferPayload($qty))
                ->assertSessionHasErrors('items.0.quantity_requested');
        }

        $this->actingAsWithSession($this->staff)
            ->post('/stock-transfers', $this->transferPayload(101))
            ->assertSessionHasErrors('items');

        $this->assertSame(0, StockTransfer::count());
    }

    public function test_request_refuses_an_expired_lot_and_a_lot_of_another_branch(): void
    {
        $expired = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 30,
            'status' => 'Active',
            'lot_number' => 'LOT-OLD',
            'expiry' => now()->subDay()->toDateString(),
        ]);

        $this->actingAsWithSession($this->staff)
            ->post('/stock-transfers', $this->transferPayload(5, [], $expired->id))
            ->assertSessionHasErrors('items');

        $bProduct = $this->branchBCopy(['med_name' => 'Ibuprofen']);
        $bLot = ProductQty::create([
            'product_id' => $bProduct->id,
            'quantity' => 30,
            'status' => 'Active',
            'lot_number' => 'LOT-B',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        // Staff in branch A tries to ship branch B's lot to branch B.
        $this->actingAsWithSession($this->staff)
            ->post('/stock-transfers', [
                'to_branch_id' => $this->branchB->id,
                'priority' => 'normal',
                'transfer_date' => now()->toDateString(),
                'items' => [['product_id' => $bProduct->id, 'products_qty_id' => $bLot->id, 'quantity_requested' => 5]],
            ])
            ->assertSessionHasErrors('items');

        // Branch A product id paired with branch B lot id.
        $this->actingAsWithSession($this->staff)
            ->post('/stock-transfers', $this->transferPayload(5, [], $bLot->id))
            ->assertSessionHasErrors('items');

        $this->assertSame(0, StockTransfer::count());
    }

    public function test_request_to_a_deleted_branch_is_refused(): void
    {
        $closed = Branch::create(['branch_name' => 'Closed Branch']);
        $closed->delete();

        $this->actingAsWithSession($this->staff)
            ->post('/stock-transfers', $this->transferPayload(5, ['to_branch_id' => $closed->id]))
            ->assertSessionHasErrors('to_branch_id');

        $this->actingAsWithSession($this->admin)
            ->post('/stock-transfers', $this->transferPayload(5, [
                'from_branch_id' => $closed->id,
                'to_branch_id' => $this->branchB->id,
            ]))
            ->assertSessionHasErrors('from_branch_id');

        $this->actingAsWithSession($this->admin)
            ->getJson(route('stock-transfers.source-products', ['branch_id' => $closed->id]))
            ->assertStatus(422);
    }

    public function test_staff_without_branch_cannot_request_or_load_products(): void
    {
        $noBranch = $this->makeUser(1, null, 'nobranch@westpoint.test');

        $this->actingAs($noBranch)->withSession(['role_id' => 1, 'branch_id' => null])
            ->post('/stock-transfers', $this->transferPayload(5))
            ->assertForbidden();

        $this->actingAs($noBranch)->withSession(['role_id' => 1, 'branch_id' => null])
            ->getJson(route('stock-transfers.source-products', ['branch_id' => $this->branchA->id]))
            ->assertForbidden();

        $this->assertSame(0, StockTransfer::count());
    }

    public function test_only_admin_can_approve_or_reject_and_only_requester_can_cancel(): void
    {
        $transfer = $this->requestTransfer(10);

        $this->actingAsWithSession($this->staff)
            ->post("/stock-transfers/{$transfer->id}/approve")->assertForbidden();
        $this->actingAsWithSession($this->staff)
            ->post("/stock-transfers/{$transfer->id}/reject", ['rejection_note' => 'x'])->assertForbidden();
        $this->actingAsWithSession($this->superadmin)
            ->post("/stock-transfers/{$transfer->id}/reject", ['rejection_note' => 'x'])->assertForbidden();
        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/cancel")->assertForbidden();
        $this->actingAsWithSession($this->superadmin)
            ->post("/stock-transfers/{$transfer->id}/cancel")->assertForbidden();

        $otherStaff = $this->makeUser(1, $this->branchA->id, 'staff2@westpoint.test');
        $this->actingAsWithSession($otherStaff)
            ->post("/stock-transfers/{$transfer->id}/cancel")->assertForbidden();

        $this->assertSame('pending', $transfer->fresh()->status);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/reject", [])
            ->assertSessionHasErrors('rejection_note');

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/reject", ['rejection_note' => 'Not needed'])
            ->assertSessionHasNoErrors();

        $this->assertSame('rejected', $transfer->fresh()->status);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);

        // A rejected transfer can no longer be approved.
        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasErrors('status');
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_cancelled_transfer_cannot_be_approved(): void
    {
        $transfer = $this->requestTransfer(10);

        $this->actingAsWithSession($this->staff)
            ->post("/stock-transfers/{$transfer->id}/cancel")
            ->assertSessionHasNoErrors();

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasErrors('status');

        $this->assertSame('cancelled', $transfer->fresh()->status);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_slip_only_for_approved_and_only_for_requester_or_admins(): void
    {
        $transfer = $this->requestTransfer(10);

        $this->actingAsWithSession($this->admin)
            ->get("/stock-transfers/{$transfer->id}/slip")->assertForbidden();

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")->assertSessionHasNoErrors();

        $this->actingAsWithSession($this->staff)
            ->get("/stock-transfers/{$transfer->id}/slip")->assertOk();
        $this->actingAsWithSession($this->admin)
            ->get("/stock-transfers/{$transfer->id}/slip")->assertOk();
        $this->actingAsWithSession($this->superadmin)
            ->get("/stock-transfers/{$transfer->id}/slip")->assertOk();

        $otherStaff = $this->makeUser(1, $this->branchB->id, 'staffb@westpoint.test');
        $this->actingAsWithSession($otherStaff)
            ->get("/stock-transfers/{$transfer->id}/slip")->assertForbidden();
        $this->actingAsWithSession($otherStaff)
            ->get("/stock-transfers/{$transfer->id}")->assertForbidden();
    }

    public function test_pending_notification_count_is_admin_only_and_counts_every_branch(): void
    {
        $this->makePendingTransfer(1);
        $this->makePendingTransfer(2);
        $this->makePendingTransfer(3, 'approved');
        $this->makePendingTransfer(4, 'rejected');

        // A pending request between other branches still counts for admins.
        $branchC = Branch::create(['branch_name' => 'Third Branch']);
        StockTransfer::create([
            'transfer_no' => 'TR-QA-00099',
            'from_branch_id' => $this->branchB->id,
            'to_branch_id' => $branchC->id,
            'requested_by' => $this->admin->id,
            'status' => 'pending',
            'priority' => 'urgent',
            'transfer_date' => now()->toDateString(),
        ]);

        $this->actingAsWithSession($this->admin)->get('/stock-transfers')
            ->assertInertia(fn (Assert $page) => $page->where('notifications.pendingStockTransfers', 3));

        $this->actingAsWithSession($this->superadmin)->get('/stock-transfers')
            ->assertInertia(fn (Assert $page) => $page->where('notifications.pendingStockTransfers', 0));

        $this->actingAsWithSession($this->staff)->get('/stock-transfers')
            ->assertInertia(fn (Assert $page) => $page->where('notifications.pendingStockTransfers', 0));
    }

    public function test_list_paginates_while_pending_tab_holds_every_pending_request(): void
    {
        for ($i = 1; $i <= 17; $i++) {
            $this->makePendingTransfer($i);
        }
        $this->makePendingTransfer(50, 'approved');

        $this->actingAsWithSession($this->admin)->get('/stock-transfers')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('transfers.data', 15)
                ->where('transfers.total', 18)
                ->has('pendingTransfers', 17));

        $this->actingAsWithSession($this->admin)->get('/stock-transfers?page=2')
            ->assertInertia(fn (Assert $page) => $page->has('transfers.data', 3));

        $this->actingAsWithSession($this->admin)->get('/stock-transfers?status=approved')
            ->assertInertia(fn (Assert $page) => $page
                ->has('transfers.data', 1)
                ->where('filters.status', 'approved'));

        // Unknown status falls back to all.
        $this->actingAsWithSession($this->admin)->get('/stock-transfers?status=bogus')
            ->assertInertia(fn (Assert $page) => $page
                ->where('transfers.total', 18)
                ->where('filters.status', 'all'));

        // Staff never see pending requests of others.
        $otherStaff = $this->makeUser(1, $this->branchA->id, 'staff3@westpoint.test');
        $this->actingAsWithSession($otherStaff)->get('/stock-transfers')
            ->assertInertia(fn (Assert $page) => $page
                ->where('transfers.total', 0)
                ->where('pendingTransfers', []));
    }

    public function test_search_with_like_wildcards_is_literal(): void
    {
        $this->makePendingTransfer(1);
        $this->makePendingTransfer(2);

        $this->actingAsWithSession($this->admin)->get('/stock-transfers?search=%25')
            ->assertInertia(fn (Assert $page) => $page->where('transfers.total', 0));

        $this->actingAsWithSession($this->admin)->get('/stock-transfers?search=LOT-001')
            ->assertInertia(fn (Assert $page) => $page->where('transfers.total', 2));
    }

    public function test_index_renders_when_a_branch_on_a_transfer_was_deleted(): void
    {
        $this->makePendingTransfer(1);
        $this->branchB->delete();

        $this->actingAsWithSession($this->admin)->get('/stock-transfers')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('transfers.data', 1)
                ->where('transfers.data.0.to_branch', null)
                ->has('branches', 1));
    }

    // =====================================================================
    // ACCESS CONTROL: confirmed defects
    // =====================================================================

    /**
     * ACL-1 (fixed in qa-fix-batch-1). /register is open to role:2,3 and RegisteredUserController::store
     * accepts any role_id, so an admin can create a superadmin account and
     * log in as it (UserController::update blocks the same thing).
     */
    public function test_acl1_admin_cannot_register_a_superadmin_account(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post('/register', [
                'name' => 'Escalated',
                'email' => 'escalated@westpoint.test',
                'password' => 'password',
                'password_confirmation' => 'password',
                'branch_id' => $this->branchA->id,
                'role_id' => 3,
            ]);

        $this->assertDatabaseMissing('users', ['email' => 'escalated@westpoint.test', 'role_id' => 3]);
    }

    /**
     * ACL-2 (fixed in qa-fix-batch-1). Deactivation is only checked inside LoginRequest. A user who is
     * already logged in (or comes back through the remember-me cookie) keeps
     * full access after being deactivated.
     */
    public function test_acl2_deactivated_user_loses_access_with_existing_session(): void
    {
        $this->actingAsWithSession($this->admin)
            ->patch("/user-management/{$this->staff->id}/toggle-status")
            ->assertRedirect();
        $this->assertSame('inactive', $this->staff->fresh()->status);

        $this->actingAsWithSession($this->staff->fresh())
            ->post('/stock-transfers', $this->transferPayload(5));

        $this->assertSame(0, StockTransfer::count(), 'Deactivated staff could still raise a stock transfer.');
    }

    /**
     * ACL-3a (fixed in qa-fix-batch-1). Staff are shown no Delete button for medicines (canEditMedicine
     * is admin-only, and update/restore are role:2,3), but DELETE
     * /medicine-inventory/{id} has no role gate.
     */
    public function test_acl3a_staff_cannot_deactivate_a_medicine_by_direct_request(): void
    {
        $this->actingAsWithSession($this->staff)
            ->delete("/medicine-inventory/{$this->product->id}")
            ->assertForbidden();

        $this->assertSame('Active', $this->product->fresh()->status);
    }

    /**
     * ACL-3b (fixed in qa-fix-batch-1). Same gap for PATCH /medicine-inventory/batch/{id}: staff can
     * overwrite a batch's quantity and expiry, bypassing InventoryStockService.
     */
    public function test_acl3b_staff_cannot_rewrite_batch_quantity_by_direct_request(): void
    {
        $this->actingAsWithSession($this->staff)
            ->patch("/medicine-inventory/batch/{$this->batch->id}", [
                'lot_number' => 'LOT-001',
                'expiry' => now()->addYears(5)->toDateString(),
                'quantity_in_pieces' => 9999,
                'adjustment_reason' => 'found stock',
            ])
            ->assertForbidden();

        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    /** ACL-3c (fixed in qa-fix-batch-1). Same gap for DELETE /medicine-inventory/batch/{id}. */
    public function test_acl3c_staff_cannot_delete_a_batch_by_direct_request(): void
    {
        $this->actingAsWithSession($this->staff)
            ->delete("/medicine-inventory/batch/{$this->batch->id}")
            ->assertForbidden();

        $this->assertSame('Active', $this->batch->fresh()->status);
    }

    /**
     * ACL-4 (fixed in qa-fix-batch-1). A user re-authenticated by the remember-me cookie gets a session
     * without role_id/branch_id (only AuthenticatedSessionController::store
     * sets them). DashboardController reads role 0, treats it as "not staff"
     * and shows every branch's sales to a staff member.
     */
    public function test_acl4_remember_me_staff_sees_only_own_branch_dashboard(): void
    {
        $login = $this->post('/login', [
            'email' => $this->staff->email,
            'password' => 'password',
            'remember' => true,
        ]);
        $login->assertRedirect();

        $recallerName = Auth::guard('web')->getRecallerName();
        $recaller = $login->getCookie($recallerName, false);
        $this->assertNotNull($recaller, 'Login with remember=true did not set a remember cookie.');

        // Session expires; only the remember cookie survives.
        $this->flushSession();
        Auth::forgetGuards();

        $response = $this->withUnencryptedCookie($recallerName, $recaller->getValue())
            ->get('/dashboard');

        $this->assertAuthenticatedAs($this->staff);

        // Fixed (qa-fix-batch-1): EnsureActiveUserSession re-syncs the session
        // from the users row, so a remember-me login is scoped like a normal one.
        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('filters.branch_id', (string) $this->branchA->id));
        $this->assertSame(1, (int) session('role_id'));
        $this->assertSame($this->branchA->id, (int) session('branch_id'));
    }

    /**
     * ACL-5 (fixed in qa-fix-batch-1). Controllers trust session('role_id') captured at login, the role
     * middleware trusts the DB. An admin demoted to staff keeps approving
     * transfers (and every other session-role check) until they log out.
     */
    public function test_acl5_demoted_admin_loses_admin_powers_on_next_request(): void
    {
        $transfer = $this->requestTransfer(10);

        $this->actingAsWithSession($this->superadmin)
            ->patch("/user-management/{$this->admin->id}", [
                'name' => $this->admin->name,
                'email' => $this->admin->email,
                'branch_id' => $this->branchA->id,
                'role_id' => 1,
            ])
            ->assertRedirect();
        $this->assertSame(1, (int) $this->admin->fresh()->role_id);

        $this->actingAs($this->admin->fresh())
            ->withSession(['role_id' => 2, 'branch_id' => $this->branchA->id])
            ->post("/stock-transfers/{$transfer->id}/approve");

        $this->assertSame('pending', $transfer->fresh()->status, 'Demoted admin approved a transfer.');
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    /**
     * ACL-6. Leftover restaurant-POS routes (category/product/table/menu/order)
     * were reachable and writable by any logged-in user. Fixed by owner
     * decision D6 (qa-fix-batch-1): the routes are removed and answer 404;
     * the tables are kept.
     */
    public function test_acl6_legacy_restaurant_routes_are_removed(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post('/category', ['cat_name' => 'Injected Category'])
            ->assertNotFound();

        $this->assertDatabaseMissing('tbl_category', ['cat_name' => 'Injected Category']);
    }

    // =====================================================================
    // ACCESS CONTROL: verified behaviour
    // =====================================================================

    public function test_guest_is_redirected_to_login_from_every_authenticated_route(): void
    {
        $checked = 0;

        foreach (RouteFacade::getRoutes() as $route) {
            $middleware = $route->gatherMiddleware();

            if (! in_array('auth', $middleware, true) || str_contains($route->uri(), 'verify-email/')) {
                continue;
            }

            $uri = '/'.ltrim(preg_replace('/\{[^}]+\}/', '1', $route->uri()), '/');
            $method = collect($route->methods())->reject(fn ($m) => $m === 'HEAD')->first();

            Auth::forgetGuards();
            $response = $this->call($method, $uri);

            $this->assertTrue(
                $response->isRedirect(url('/login')),
                "Guest {$method} {$uri} returned {$response->status()}",
            );
            $checked++;
        }

        $this->assertGreaterThan(100, $checked);
    }

    public function test_role_gated_routes_refuse_roles_outside_their_list(): void
    {
        $users = [1 => $this->staff, 2 => $this->admin, 3 => $this->superadmin];
        $ids = [
            'branch-management' => $this->branchB->id,
            'user-management' => $this->staff->id,
            'medicine-inventory' => $this->product->id,
        ];
        $checked = 0;

        foreach (RouteFacade::getRoutes() as $route) {
            $roleMiddleware = collect($route->gatherMiddleware())
                ->first(fn ($m) => is_string($m) && str_starts_with($m, 'role:'));

            if (! $roleMiddleware) {
                continue;
            }

            $allowed = array_map('intval', explode(',', substr($roleMiddleware, 5)));
            $prefix = explode('/', $route->uri())[0];
            $uri = '/'.preg_replace('/\{[^}]+\}/', (string) ($ids[$prefix] ?? 1), $route->uri());
            $method = collect($route->methods())->reject(fn ($m) => $m === 'HEAD')->first();

            foreach ($users as $roleId => $user) {
                if (in_array($roleId, $allowed, true)) {
                    continue;
                }

                $this->actingAsWithSession($user)
                    ->call($method, $uri)
                    ->assertForbidden();
                $checked++;
            }
        }

        $this->assertGreaterThan(20, $checked);
        $this->assertSame('Active', $this->product->fresh()->status);
        $this->assertNull(Branch::find($this->branchB->id)?->deleted_at);
    }

    public function test_admin_cannot_promote_anyone_to_superadmin_or_touch_superadmins(): void
    {
        $this->actingAsWithSession($this->admin)
            ->patch("/user-management/{$this->staff->id}", [
                'name' => $this->staff->name,
                'email' => $this->staff->email,
                'branch_id' => $this->branchA->id,
                'role_id' => 3,
            ]);
        $this->assertSame(1, (int) $this->staff->fresh()->role_id);

        $this->actingAsWithSession($this->admin)
            ->patch("/user-management/{$this->admin->id}", [
                'name' => $this->admin->name,
                'email' => $this->admin->email,
                'branch_id' => $this->branchA->id,
                'role_id' => 3,
            ]);
        $this->assertSame(2, (int) $this->admin->fresh()->role_id);

        $this->actingAsWithSession($this->admin)
            ->patch("/user-management/{$this->superadmin->id}/toggle-status")
            ->assertForbidden();
        $this->assertSame('active', $this->superadmin->fresh()->status ?? 'active');

        $this->actingAsWithSession($this->admin)
            ->patch("/user-management/{$this->superadmin->id}", [
                'name' => 'x',
                'email' => $this->superadmin->email,
                'branch_id' => $this->branchA->id,
                'role_id' => 1,
                'password' => 'newpassword123',
                'password_confirmation' => 'newpassword123',
            ])
            ->assertForbidden();
        $this->assertSame(3, (int) $this->superadmin->fresh()->role_id);
    }

    public function test_superadmin_can_register_superadmin_and_admin_can_register_staff(): void
    {
        $this->actingAsWithSession($this->superadmin)
            ->post('/register', [
                'name' => 'Second Super',
                'email' => 'super2@westpoint.test',
                'password' => 'password',
                'password_confirmation' => 'password',
                'branch_id' => $this->branchA->id,
                'role_id' => 3,
            ])
            ->assertRedirect('/user-management');
        $this->assertDatabaseHas('users', ['email' => 'super2@westpoint.test', 'role_id' => 3]);

        $this->actingAsWithSession($this->admin)
            ->post('/register', [
                'name' => 'New Staff',
                'email' => 'newstaff@westpoint.test',
                'password' => 'password',
                'password_confirmation' => 'password',
                'branch_id' => $this->branchB->id,
                'role_id' => 1,
            ])
            ->assertRedirect('/user-management');
        $this->assertDatabaseHas('users', ['email' => 'newstaff@westpoint.test', 'role_id' => 1]);
    }

    public function test_login_sets_session_role_and_branch_and_refuses_inactive_users(): void
    {
        $this->post('/login', ['email' => $this->staff->email, 'password' => 'password'])
            ->assertRedirect(route('dashboard', absolute: false))
            ->assertSessionHas('role_id', 1)
            ->assertSessionHas('branch_id', $this->branchA->id);

        $this->post('/logout');
        Auth::forgetGuards();

        $this->staff->update(['status' => 'inactive']);
        $this->post('/login', ['email' => $this->staff->email, 'password' => 'password'])
            ->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_staff_cannot_reach_other_branch_records_by_id(): void
    {
        $bProduct = $this->branchBCopy(['med_name' => 'Cetirizine']);
        $bLot = ProductQty::create([
            'product_id' => $bProduct->id,
            'quantity' => 40,
            'status' => 'Active',
            'lot_number' => 'LOT-B9',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $this->actingAsWithSession($this->staff)
            ->delete("/medicine-inventory/{$bProduct->id}")->assertForbidden();
        $this->actingAsWithSession($this->staff)
            ->patch("/medicine-inventory/batch/{$bLot->id}", [
                'quantity_in_pieces' => 1,
                'adjustment_reason' => 'x',
            ])->assertForbidden();
        $this->actingAsWithSession($this->staff)
            ->delete("/medicine-inventory/batch/{$bLot->id}")->assertForbidden();
        $this->actingAsWithSession($this->staff)
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchB->id]))->assertForbidden();
        $this->actingAsWithSession($this->staff)
            ->getJson(route('stock-transfers.source-products', ['branch_id' => $this->branchB->id]))->assertForbidden();

        $log = InventoryMovementLog::query()->create([
            'branch_id' => $this->branchB->id,
            'movement_type' => InventoryMovementLog::TYPE_TRANSFER_IN,
            'reference_label' => 'QA',
            'medicine_name' => 'Cetirizine',
            'quantity' => 1,
            'performed_by' => $this->admin->id,
        ]);
        $this->actingAsWithSession($this->staff)
            ->getJson("/movement-logs/{$log->getKey()}")->assertForbidden();

        $this->assertSame('Active', $bProduct->fresh()->status);
        $this->assertSame(40, (int) $bLot->fresh()->quantity);
        $this->assertSame('Active', $bLot->fresh()->status);
    }
}
