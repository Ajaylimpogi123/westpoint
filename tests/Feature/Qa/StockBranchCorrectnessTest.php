<?php

namespace Tests\Feature\Qa;

use App\Models\BranchCustomer;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * Black-box acceptance tests for feature `stock-branch-correctness`.
 * Criteria ids (AC-n) refer to `.claude/handoff/stock-branch-correctness.md`.
 */
class StockBranchCorrectnessTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected MedicineProduct $productB;

    protected ProductQty $batchB;

    protected BranchCustomer $customerA;

    protected BranchCustomer $customerB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();

        $this->productB = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Amoxicillin',
            'dose' => '250mg',
            'form' => 'Capsule',
            'pack_size' => 10,
            'brand_name' => 'Amoxil',
            'retail_price' => 8.00,
            'wholesale_price' => 70.00,
            'status' => 'Active',
            'is_generic' => false,
        ]);

        $this->batchB = ProductQty::create([
            'product_id' => $this->productB->id,
            'quantity' => 200,
            'status' => 'Active',
            'lot_number' => 'LOT-B-001',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $this->customerA = BranchCustomer::create([
            'branch_id' => $this->branchA->id,
            'first_name' => 'Ana',
            'last_name' => 'Alpha',
            'customer_type' => 'Regular',
            'status' => 'active',
        ]);

        $this->customerB = BranchCustomer::create([
            'branch_id' => $this->branchB->id,
            'first_name' => 'Ben',
            'last_name' => 'Bravo',
            'customer_type' => 'Regular',
            'status' => 'active',
        ]);
    }

    // ------------------------------------------------------------------
    // Session helpers
    // ------------------------------------------------------------------

    private function asAdminInBranchA()
    {
        return $this->actingAsWithSession($this->admin);
    }

    private function asSuperadminWithoutBranch()
    {
        return $this->actingAs($this->superadmin)
            ->withSession(['role_id' => 3, 'branch_id' => null]);
    }

    private function asStaffInBranchA()
    {
        return $this->actingAsWithSession($this->staff);
    }

    // ------------------------------------------------------------------
    // Payload builders
    // ------------------------------------------------------------------

    private function stockInPayload(int $branchId, int $pdId, array $item = [], array $extra = []): array
    {
        return array_merge([
            'supplier_name' => 'Acme Pharma',
            'delivery_date' => now()->toDateString(),
            'branch_id' => $branchId,
            'received_by' => 'QA Receiver',
            'items' => [array_merge([
                'pd_id' => $pdId,
                'batch_number' => 'QA-IN-001',
                'expiry_date' => now()->addYears(2)->toDateString(),
                'quantity_received' => 5,
                'unit_type' => 'Piece',
            ], $item)],
        ], $extra);
    }

    private function stockOutPayload(int $branchId, int $pdId, int $batchId, array $item = [], array $extra = []): array
    {
        return array_merge([
            'transaction_subtype' => 'Returned to supplier',
            'branch_id' => $branchId,
            'issued_by' => 'QA Issuer',
            'items' => [array_merge([
                'pd_id' => $pdId,
                'products_qty_id' => $batchId,
                'quantity_deducted' => 5,
                'unit_type' => 'Piece',
            ], $item)],
        ], $extra);
    }

    private function returnPayload(int $branchId, int $customerId, int $pdId, array $item = [], array $extra = []): array
    {
        return array_merge([
            'customer_id' => $customerId,
            'return_date' => now()->toDateString(),
            'branch_id' => $branchId,
            'received_by' => 'QA Receiver',
            'items' => [array_merge([
                'pd_id' => $pdId,
                'batch_number' => 'QA-RET-001',
                'expiry_date' => now()->addYears(2)->toDateString(),
                'quantity_received' => 4,
                'unit_type' => 'Piece',
            ], $item)],
        ], $extra);
    }

    // ------------------------------------------------------------------
    // Assertion helpers
    // ------------------------------------------------------------------

    private function piecesInLot(int $productId, string $lot): int
    {
        return (int) ProductQty::query()
            ->where('product_id', $productId)
            ->where('lot_number', $lot)
            ->sum('quantity');
    }

    private function assertNoServerError(TestResponse $response): void
    {
        $this->assertLessThan(500, $response->status(), 'Server error: ' . $response->getContent());
    }

    private function assertStoreSucceeded(TestResponse $response): void
    {
        $this->assertNoServerError($response);
        $response->assertStatus(302);
        $response->assertSessionHasNoErrors();
        $this->assertNull(session('error'), 'Unexpected flash error: ' . session('error'));
    }

    /**
     * Rejected = 4xx, or a redirect carrying validation errors / a flash error.
     */
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

    private function assertNothingWritten(): void
    {
        $this->assertDatabaseCount('tbl_stock_ins', 0);
        $this->assertDatabaseCount('tbl_stock_outs', 0);
        $this->assertDatabaseCount('tbl_returns', 0);
        $this->assertDatabaseCount('tbl_inventory_movement_logs', 0);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(200, (int) $this->batchB->fresh()->quantity);
    }

    // ==================================================================
    // Stock In
    // ==================================================================

    /** AC-1 */
    public function test_admin_in_branch_a_can_stock_in_to_branch_b_in_pieces(): void
    {
        $response = $this->asAdminInBranchA()
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->productB->id, [
                'quantity_received' => 7,
            ]));

        $this->assertStoreSucceeded($response);
        $this->assertDatabaseHas('tbl_stock_ins', ['branch_id' => $this->branchB->id]);
        $this->assertSame(7, $this->piecesInLot($this->productB->id, 'QA-IN-001'));
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'branch_id' => $this->branchB->id,
            'pd_id' => $this->productB->id,
            'quantity' => 7,
        ]);
        $this->assertDatabaseMissing('tbl_inventory_movement_logs', ['branch_id' => $this->branchA->id]);
    }

    /** AC-2, AC-3 */
    public function test_superadmin_without_session_branch_can_stock_in_boxes_to_branch_b(): void
    {
        $response = $this->asSuperadminWithoutBranch()
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->productB->id, [
                'quantity_received' => 3,
                'unit_type' => 'Box',
            ]));

        $this->assertStoreSucceeded($response);
        $this->assertDatabaseHas('tbl_stock_ins', ['branch_id' => $this->branchB->id]);
        $this->assertDatabaseHas('tbl_stock_in_items', [
            'pd_id' => $this->productB->id,
            'quantity_received' => 3,
            'pieces_received' => 30,
            'unit_type' => 'Box',
        ]);
        $this->assertSame(30, $this->piecesInLot($this->productB->id, 'QA-IN-001'));
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'branch_id' => $this->branchB->id,
            'quantity' => 30,
        ]);
    }

    /** AC-4 */
    public function test_stock_in_rejects_product_not_in_chosen_branch_as_validation_error(): void
    {
        $response = $this->asAdminInBranchA()
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->product->id));

        $this->assertNoServerError($response);
        $response->assertSessionHasErrors('items.0.pd_id');
        $this->assertNothingWritten();
        $this->assertSame(0, $this->piecesInLot($this->product->id, 'QA-IN-001'));
    }

    /** AC-5 */
    public function test_staff_cannot_stock_in_to_another_branch(): void
    {
        $response = $this->asStaffInBranchA()
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->productB->id));

        $this->assertNoServerError($response);
        $response->assertSessionHasErrors('branch_id');
        $this->assertNothingWritten();
        $this->assertSame(0, $this->piecesInLot($this->productB->id, 'QA-IN-001'));
    }

    /** AC-5 (positive) */
    public function test_staff_can_stock_in_to_own_branch(): void
    {
        $response = $this->asStaffInBranchA()
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchA->id, $this->product->id, [
                'quantity_received' => 2,
                'unit_type' => 'Box',
            ]));

        $this->assertStoreSucceeded($response);
        $this->assertSame(20, $this->piecesInLot($this->product->id, 'QA-IN-001'));
        $this->assertDatabaseHas('tbl_inventory_movement_logs', ['branch_id' => $this->branchA->id, 'quantity' => 20]);
    }

    /** AC-6 */
    public function test_staff_cannot_stock_in_other_branch_product_into_own_branch(): void
    {
        $response = $this->asStaffInBranchA()
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchA->id, $this->productB->id));

        $this->assertNoServerError($response);
        $response->assertSessionHasErrors('items.0.pd_id');
        $this->assertNothingWritten();
    }

    /** AC-7 */
    public function test_stock_in_replay_with_same_idempotency_key_posts_once(): void
    {
        $payload = $this->stockInPayload($this->branchB->id, $this->productB->id, [
            'quantity_received' => 2,
            'unit_type' => 'Box',
        ], ['idempotency_key' => 'qa-si-replay-1']);

        $this->asAdminInBranchA()->post(route('stock-in.store'), $payload)->assertStatus(302);
        $second = $this->asAdminInBranchA()->post(route('stock-in.store'), $payload);

        $this->assertNoServerError($second);
        $this->assertNull(session('error'), 'Replay must not be reported as a failure.');
        $this->assertDatabaseCount('tbl_stock_ins', 1);
        $this->assertSame(20, $this->piecesInLot($this->productB->id, 'QA-IN-001'));
        $this->assertDatabaseCount('tbl_inventory_movement_logs', 1);
    }

    /** AC-8 */
    public function test_stock_in_rejected_cross_branch_submit_can_be_retried_with_same_key(): void
    {
        $key = 'qa-si-retry-1';

        $this->asAdminInBranchA()->post(
            route('stock-in.store'),
            $this->stockInPayload($this->branchB->id, $this->product->id, [], ['idempotency_key' => $key])
        );
        $this->assertDatabaseCount('tbl_stock_ins', 0);

        $retry = $this->asAdminInBranchA()->post(
            route('stock-in.store'),
            $this->stockInPayload($this->branchB->id, $this->productB->id, [], ['idempotency_key' => $key])
        );

        $this->assertStoreSucceeded($retry);
        $this->assertDatabaseCount('tbl_stock_ins', 1);
        $this->assertSame(5, $this->piecesInLot($this->productB->id, 'QA-IN-001'));
    }

    /** AC-9 */
    public function test_stock_in_quantity_and_expiry_validation_for_cross_branch_admin(): void
    {
        $cases = [
            ['quantity_received' => 0],
            ['quantity_received' => -3],
            ['quantity_received' => 1_000_001],
            ['quantity_received' => 1.5],
            ['expiry_date' => now()->subDay()->toDateString()],
            ['unit_type' => 'Carton'],
        ];

        foreach ($cases as $override) {
            $response = $this->asAdminInBranchA()
                ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->productB->id, $override));

            $this->assertNoServerError($response);
            $response->assertSessionHasErrors();
        }

        $this->assertNothingWritten();
    }

    // ==================================================================
    // Stock Out
    // ==================================================================

    /** AC-10 */
    public function test_admin_in_branch_a_can_return_branch_b_stock_to_supplier_in_boxes(): void
    {
        $response = $this->asAdminInBranchA()
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id, [
                'quantity_deducted' => 2,
                'unit_type' => 'Box',
                'pieces_per_box' => 10,
            ]));

        $this->assertStoreSucceeded($response);
        $this->assertDatabaseHas('tbl_stock_outs', ['branch_id' => $this->branchB->id]);
        $this->assertSame(180, (int) $this->batchB->fresh()->quantity);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'branch_id' => $this->branchB->id,
            'pd_id' => $this->productB->id,
            'quantity' => -20,
        ]);
    }

    /** AC-11 */
    public function test_superadmin_without_session_branch_can_create_delivery_from_branch_b(): void
    {
        $response = $this->asSuperadminWithoutBranch()
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id, [
                'quantity_deducted' => 6,
            ], [
                'transaction_subtype' => 'Delivery to Customer',
                'delivered_to' => 'Ben Bravo',
            ]));

        $this->assertStoreSucceeded($response);
        $this->assertDatabaseHas('tbl_stock_outs', [
            'branch_id' => $this->branchB->id,
            'transaction_subtype' => 'Delivery to Customer',
        ]);
        // Delivery deducts only on confirmation.
        $this->assertSame(200, (int) $this->batchB->fresh()->quantity);
    }

    /** AC-12 */
    public function test_stock_out_rejects_lot_from_another_branch_as_validation_error(): void
    {
        // Branch B product, but the lot belongs to branch A.
        $response = $this->asAdminInBranchA()
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batch->id));

        $this->assertNoServerError($response);
        $response->assertSessionHasErrors('items.0.products_qty_id');
        $this->assertNothingWritten();
    }

    /** AC-12 */
    public function test_stock_out_rejects_product_and_lot_from_another_branch_as_validation_error(): void
    {
        // Source = branch B, but both medicine and lot are branch A's.
        $response = $this->asAdminInBranchA()
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->product->id, $this->batch->id));

        $this->assertNoServerError($response);
        $response->assertSessionHasErrors('items.0.pd_id');
        $this->assertNothingWritten();
    }

    /** AC-13 */
    public function test_stock_out_insufficient_stock_in_chosen_branch_is_rejected_and_key_released(): void
    {
        $key = 'qa-so-insufficient-1';

        $first = $this->asAdminInBranchA()
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id, [
                'quantity_deducted' => 21,
                'unit_type' => 'Box',
                'pieces_per_box' => 10,
            ], ['idempotency_key' => $key]));

        $this->assertRejected($first);
        $this->assertNothingWritten();

        $retry = $this->asAdminInBranchA()
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id, [
                'quantity_deducted' => 20,
                'unit_type' => 'Box',
                'pieces_per_box' => 10,
            ], ['idempotency_key' => $key]));

        $this->assertStoreSucceeded($retry);
        $this->assertSame(0, (int) $this->batchB->fresh()->quantity);
    }

    /** AC-14 */
    public function test_stock_out_rejects_expired_lot_in_chosen_branch(): void
    {
        $expired = ProductQty::create([
            'product_id' => $this->productB->id,
            'quantity' => 50,
            'status' => 'Expired',
            'lot_number' => 'LOT-B-EXP',
            'expiry' => now()->subDays(3)->toDateString(),
        ]);

        // Past expiry but status still Active (nightly sweep has not run yet).
        $stale = ProductQty::create([
            'product_id' => $this->productB->id,
            'quantity' => 40,
            'status' => 'Active',
            'lot_number' => 'LOT-B-STALE',
            'expiry' => now()->subDay()->toDateString(),
        ]);

        foreach ([$expired, $stale] as $lot) {
            $response = $this->asAdminInBranchA()
                ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $lot->id, [], [
                    'transaction_subtype' => 'Returned to supplier',
                ]));

            $this->assertNoServerError($response);
            $response->assertSessionHasErrors('items.0.products_qty_id');
        }

        $this->assertSame(50, (int) $expired->fresh()->quantity);
        $this->assertSame(40, (int) $stale->fresh()->quantity);
        $this->assertNothingWritten();
    }

    /** AC-15 */
    public function test_staff_cannot_stock_out_from_another_branch(): void
    {
        $response = $this->asStaffInBranchA()
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id));

        $this->assertNoServerError($response);
        $response->assertSessionHasErrors('branch_id');
        $this->assertNothingWritten();
    }

    /** AC-15 */
    public function test_staff_cannot_stock_out_other_branch_lot_via_own_branch(): void
    {
        $response = $this->asStaffInBranchA()
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchA->id, $this->productB->id, $this->batchB->id));

        $this->assertNoServerError($response);
        $response->assertSessionHasErrors('items.0.pd_id');
        $this->assertNothingWritten();
    }

    /** AC-15 */
    public function test_staff_without_session_branch_is_forbidden_on_store_routes(): void
    {
        // Since qa-fix-batch-1 the session branch is re-synced from users.branch_id
        // on every request, so "no session branch" means a staff row with no branch.
        $this->staff->update(['branch_id' => null]);
        $as = fn () => $this->actingAs($this->staff->fresh())->withSession(['role_id' => 1, 'branch_id' => null]);

        $as()->post(route('stock-in.store'), $this->stockInPayload($this->branchA->id, $this->product->id))->assertForbidden();
        $as()->post(route('stock-out.store'), $this->stockOutPayload($this->branchA->id, $this->product->id, $this->batch->id))->assertForbidden();
        $as()->post(route('customer-return.store'), $this->returnPayload($this->branchA->id, $this->customerA->customer_id, $this->product->id))->assertForbidden();
        $as()->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchA->id]))->assertForbidden();
        $as()->getJson(route('customer-management.for-branch', ['branch_id' => $this->branchA->id]))->assertForbidden();

        $this->assertNothingWritten();
    }

    /** AC-34 */
    public function test_soft_deleted_branch_is_rejected_as_destination_or_source(): void
    {
        $this->branchB->delete();

        $this->asAdminInBranchA()
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->productB->id))
            ->assertSessionHasErrors('branch_id');

        $this->asAdminInBranchA()
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id))
            ->assertSessionHasErrors('branch_id');

        $this->asAdminInBranchA()
            ->post(route('customer-return.store'), $this->returnPayload($this->branchB->id, $this->customerB->customer_id, $this->productB->id))
            ->assertSessionHasErrors('branch_id');

        $this->assertNothingWritten();
    }

    /** AC-16 */
    public function test_stock_out_replay_with_same_idempotency_key_deducts_once(): void
    {
        $payload = $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id, [
            'quantity_deducted' => 1,
            'unit_type' => 'Box',
            'pieces_per_box' => 10,
        ], ['idempotency_key' => 'qa-so-replay-1']);

        $this->asAdminInBranchA()->post(route('stock-out.store'), $payload)->assertStatus(302);
        $second = $this->asAdminInBranchA()->post(route('stock-out.store'), $payload);

        $this->assertNoServerError($second);
        $this->assertNull(session('error'), 'Replay must not be reported as a failure.');
        $this->assertDatabaseCount('tbl_stock_outs', 1);
        $this->assertSame(190, (int) $this->batchB->fresh()->quantity);
        $this->assertDatabaseCount('tbl_inventory_movement_logs', 1);
    }

    /** AC-17 */
    public function test_stock_out_quantity_validation(): void
    {
        $cases = [
            ['quantity_deducted' => 0],
            ['quantity_deducted' => -1],
            ['quantity_deducted' => 1_000_001],
            ['unit_type' => 'Box', 'pieces_per_box' => 0],
        ];

        foreach ($cases as $override) {
            $response = $this->asAdminInBranchA()
                ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id, $override));

            $this->assertRejected($response);
        }

        $this->assertNothingWritten();
    }

    private function createDeliveryInBranchB(int $pieces = 6): int
    {
        $this->asSuperadminWithoutBranch()
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id, [
                'quantity_deducted' => $pieces,
            ], [
                'transaction_subtype' => 'Delivery to Customer',
                'delivered_to' => 'Ben Bravo',
            ]));

        $id = (int) DB::table('tbl_stock_outs')->where('branch_id', $this->branchB->id)->value('stock_out_id');
        $this->assertGreaterThan(0, $id, 'Setup: branch B delivery was not created.');

        return $id;
    }

    /** AC-18 */
    public function test_admin_in_branch_a_can_view_edit_update_and_confirm_branch_b_delivery(): void
    {
        $id = $this->createDeliveryInBranchB();

        $this->asAdminInBranchA()->getJson(route('stock-out.show', $id))->assertOk();
        $this->asAdminInBranchA()->get(route('stock-out.receipt', $id))->assertOk();
        $this->asAdminInBranchA()->getJson(route('stock-out.edit', $id))
            ->assertOk()
            ->assertJsonPath('stock_out.branch_id', $this->branchB->id)
            ->assertJsonPath('stock_out.branch.branch_name', 'Second Branch');

        $update = $this->asAdminInBranchA()->put(route('stock-out.update', $id), [
            'issued_by' => 'QA Issuer',
            'delivered_to' => 'Ben Bravo',
            'items' => [[
                'pd_id' => $this->productB->id,
                'products_qty_id' => $this->batchB->id,
                'quantity_deducted' => 1,
                'unit_type' => 'Box',
                'pieces_per_box' => 10,
            ]],
        ]);
        $this->assertStoreSucceeded($update);
        $this->assertDatabaseHas('tbl_stock_out_items', ['stock_out_id' => $id, 'pieces_deducted' => 10]);

        $confirm = $this->asAdminInBranchA()->post(route('stock-out.confirm-delivery', $id));
        $this->assertStoreSucceeded($confirm);

        $this->assertSame(190, (int) $this->batchB->fresh()->quantity);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'branch_id' => $this->branchB->id,
            'quantity' => -10,
        ]);
        $this->assertDatabaseHas('tbl_sales', ['branch_id' => $this->branchB->id]);
    }

    /** AC-18 */
    public function test_superadmin_without_session_branch_can_view_and_confirm_branch_b_delivery(): void
    {
        $id = $this->createDeliveryInBranchB(6);

        $this->asSuperadminWithoutBranch()->getJson(route('stock-out.show', $id))->assertOk();
        $this->asSuperadminWithoutBranch()->get(route('stock-out.receipt', $id))->assertOk();
        $this->asSuperadminWithoutBranch()->getJson(route('stock-out.edit', $id))->assertOk();

        $confirm = $this->asSuperadminWithoutBranch()->post(route('stock-out.confirm-delivery', $id));
        $this->assertStoreSucceeded($confirm);
        $this->assertSame(194, (int) $this->batchB->fresh()->quantity);
    }

    /** AC-14 / AC-18 (QA-1) */
    public function test_confirm_delivery_refuses_lot_that_expired_after_the_delivery_was_recorded(): void
    {
        $id = $this->createDeliveryInBranchB(6);

        // The lot passes its expiry date before the delivery is confirmed.
        $this->batchB->update(['expiry' => now()->subDay()->toDateString()]);

        $response = $this->asAdminInBranchA()->post(route('stock-out.confirm-delivery', $id));

        $this->assertRejected($response);
        $this->assertSame(200, (int) $this->batchB->fresh()->quantity);
        $this->assertDatabaseHas('tbl_stock_outs', ['stock_out_id' => $id, 'delivery_confirmed' => 0]);
        $this->assertDatabaseCount('tbl_sales', 0);
        $this->assertDatabaseCount('tbl_inventory_movement_logs', 0);
    }

    /** AC-19 */
    public function test_staff_cannot_view_edit_update_or_confirm_other_branch_stock_out(): void
    {
        $id = $this->createDeliveryInBranchB(6);

        $this->asStaffInBranchA()->getJson(route('stock-out.show', $id))->assertForbidden();
        $this->asStaffInBranchA()->get(route('stock-out.receipt', $id))->assertForbidden();
        $this->asStaffInBranchA()->getJson(route('stock-out.edit', $id))->assertForbidden();

        $this->asStaffInBranchA()->put(route('stock-out.update', $id), [
            'issued_by' => 'Staff User',
            'items' => [[
                'pd_id' => $this->productB->id,
                'products_qty_id' => $this->batchB->id,
                'quantity_deducted' => 50,
                'unit_type' => 'Piece',
            ]],
        ])->assertForbidden();

        $this->asStaffInBranchA()->post(route('stock-out.confirm-delivery', $id))->assertForbidden();

        $this->assertDatabaseHas('tbl_stock_out_items', ['stock_out_id' => $id, 'pieces_deducted' => 6]);
        $this->assertSame(200, (int) $this->batchB->fresh()->quantity);
        $this->assertDatabaseHas('tbl_stock_outs', ['stock_out_id' => $id, 'delivery_confirmed' => 0]);
    }

    /** AC-20 */
    public function test_stock_out_update_rejects_lot_from_other_branch(): void
    {
        $id = $this->createDeliveryInBranchB(6);

        $response = $this->asAdminInBranchA()->put(route('stock-out.update', $id), [
            'issued_by' => 'QA Issuer',
            'items' => [[
                'pd_id' => $this->product->id,
                'products_qty_id' => $this->batch->id,
                'quantity_deducted' => 1,
                'unit_type' => 'Piece',
            ]],
        ]);

        $this->assertRejected($response);
        $this->assertDatabaseHas('tbl_stock_out_items', [
            'stock_out_id' => $id,
            'products_qty_id' => $this->batchB->id,
            'pieces_deducted' => 6,
        ]);
        $this->assertDatabaseMissing('tbl_stock_out_items', ['products_qty_id' => $this->batch->id]);
    }

    // ==================================================================
    // Customer Return
    // ==================================================================

    /** AC-21 */
    public function test_admin_in_branch_a_can_record_customer_return_in_branch_b(): void
    {
        $response = $this->asAdminInBranchA()
            ->post(route('customer-return.store'), $this->returnPayload($this->branchB->id, $this->customerB->customer_id, $this->productB->id, [
                'quantity_received' => 2,
                'unit_type' => 'Box',
            ]));

        $this->assertStoreSucceeded($response);
        $this->assertDatabaseHas('tbl_returns', ['branch_id' => $this->branchB->id]);
        $this->assertSame(20, $this->piecesInLot($this->productB->id, 'QA-RET-001'));
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'branch_id' => $this->branchB->id,
            'quantity' => 20,
        ]);
    }

    /** AC-22 */
    public function test_superadmin_without_session_branch_can_record_customer_return_in_branch_b(): void
    {
        $response = $this->asSuperadminWithoutBranch()
            ->post(route('customer-return.store'), $this->returnPayload($this->branchB->id, $this->customerB->customer_id, $this->productB->id));

        $this->assertStoreSucceeded($response);
        $this->assertDatabaseHas('tbl_returns', ['branch_id' => $this->branchB->id]);
        $this->assertSame(4, $this->piecesInLot($this->productB->id, 'QA-RET-001'));
    }

    /** AC-23 */
    public function test_customer_return_rejects_product_from_other_branch_as_validation_error(): void
    {
        $response = $this->asAdminInBranchA()
            ->post(route('customer-return.store'), $this->returnPayload($this->branchB->id, $this->customerB->customer_id, $this->product->id));

        $this->assertNoServerError($response);
        $response->assertSessionHasErrors('items.0.pd_id');
        $this->assertNothingWritten();
    }

    /** AC-23 */
    public function test_customer_return_rejects_customer_from_other_branch(): void
    {
        $response = $this->asAdminInBranchA()
            ->post(route('customer-return.store'), $this->returnPayload($this->branchB->id, $this->customerA->customer_id, $this->productB->id, [], [
                'idempotency_key' => 'qa-ret-retry-1',
            ]));

        $this->assertNoServerError($response);
        $response->assertSessionHasErrors('customer_id');
        $this->assertNothingWritten();

        // The rejected submit must not consume the key.
        $retry = $this->asAdminInBranchA()
            ->post(route('customer-return.store'), $this->returnPayload($this->branchB->id, $this->customerB->customer_id, $this->productB->id, [], [
                'idempotency_key' => 'qa-ret-retry-1',
            ]));

        $this->assertStoreSucceeded($retry);
        $this->assertDatabaseCount('tbl_returns', 1);
    }

    /** AC-24 */
    public function test_staff_cannot_record_customer_return_in_other_branch(): void
    {
        $response = $this->asStaffInBranchA()
            ->post(route('customer-return.store'), $this->returnPayload($this->branchB->id, $this->customerB->customer_id, $this->productB->id));

        $this->assertNoServerError($response);
        $response->assertSessionHasErrors('branch_id');
        $this->assertNothingWritten();
    }

    /** AC-25 */
    public function test_customer_return_replay_with_same_idempotency_key_posts_once(): void
    {
        $payload = $this->returnPayload($this->branchB->id, $this->customerB->customer_id, $this->productB->id, [], [
            'idempotency_key' => 'qa-ret-replay-1',
        ]);

        $this->asAdminInBranchA()->post(route('customer-return.store'), $payload)->assertStatus(302);
        $second = $this->asAdminInBranchA()->post(route('customer-return.store'), $payload);

        $this->assertNoServerError($second);
        $this->assertNull(session('error'), 'Replay must not be reported as a failure.');
        $this->assertDatabaseCount('tbl_returns', 1);
        $this->assertSame(4, $this->piecesInLot($this->productB->id, 'QA-RET-001'));
    }

    // ==================================================================
    // Branch recorded and displayed: history, show, receipt
    // ==================================================================

    private function seedBranchBTransactions(): array
    {
        $this->asSuperadminWithoutBranch()->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->productB->id));
        $this->asSuperadminWithoutBranch()->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id));
        $this->asSuperadminWithoutBranch()->post(route('customer-return.store'), $this->returnPayload($this->branchB->id, $this->customerB->customer_id, $this->productB->id));

        $ids = [
            'in' => (int) DB::table('tbl_stock_ins')->where('branch_id', $this->branchB->id)->value('stock_in_id'),
            'out' => (int) DB::table('tbl_stock_outs')->where('branch_id', $this->branchB->id)->value('stock_out_id'),
            'ret' => (int) DB::table('tbl_returns')->where('branch_id', $this->branchB->id)->value('return_id'),
        ];

        foreach ($ids as $kind => $id) {
            $this->assertGreaterThan(0, $id, "Setup: branch B {$kind} transaction was not created.");
        }

        return $ids;
    }

    /** AC-26 */
    public function test_history_props_include_branch_name_for_admin_unfiltered_and_filtered(): void
    {
        $this->seedBranchBTransactions();

        $this->asAdminInBranchA()->get(route('medicine-inventory.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('stockIns.data.0.branch_id', $this->branchB->id)
                ->where('stockIns.data.0.branch.branch_name', 'Second Branch')
                ->where('stockOuts.data.0.branch_id', $this->branchB->id)
                ->where('stockOuts.data.0.branch.branch_name', 'Second Branch')
                ->where('customerReturns.data.0.branch_id', $this->branchB->id)
                ->where('customerReturns.data.0.branch.branch_name', 'Second Branch')
                ->etc());

        $this->asAdminInBranchA()->get(route('medicine-inventory.index', [
            'stock_in_branch_id' => $this->branchB->id,
            'stock_out_branch_id' => $this->branchB->id,
            'return_branch_id' => $this->branchB->id,
        ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('stockIns.data.0.branch.branch_name', 'Second Branch')
                ->where('stockOuts.data.0.branch.branch_name', 'Second Branch')
                ->where('customerReturns.data.0.branch.branch_name', 'Second Branch')
                ->etc());
    }

    /** AC-26 */
    public function test_superadmin_without_session_branch_sees_history_with_branch_name(): void
    {
        $this->seedBranchBTransactions();

        $this->asSuperadminWithoutBranch()->get(route('medicine-inventory.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('stockIns.data.0.branch.branch_name', 'Second Branch')
                ->where('stockOuts.data.0.branch.branch_name', 'Second Branch')
                ->where('customerReturns.data.0.branch.branch_name', 'Second Branch')
                ->etc());
    }

    /** AC-27 */
    public function test_staff_history_excludes_other_branch_transactions(): void
    {
        $this->seedBranchBTransactions();

        $this->asStaffInBranchA()->get(route('medicine-inventory.index', [
            'stock_in_branch_id' => $this->branchB->id,
            'stock_out_branch_id' => $this->branchB->id,
            'return_branch_id' => $this->branchB->id,
        ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('stockIns.data', 0)
                ->has('stockOuts.data', 0)
                ->has('customerReturns.data', 0)
                ->etc());

        // Staff's own-branch rows also carry the branch name.
        $this->asStaffInBranchA()->post(route('stock-in.store'), $this->stockInPayload($this->branchA->id, $this->product->id));

        $this->asStaffInBranchA()->get(route('medicine-inventory.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('stockIns.data', 1)
                ->where('stockIns.data.0.branch_id', $this->branchA->id)
                ->where('stockIns.data.0.branch.branch_name', 'Main Branch')
                ->etc());
    }

    /** AC-28 */
    public function test_show_json_includes_branch_id_and_name(): void
    {
        $ids = $this->seedBranchBTransactions();

        $this->asAdminInBranchA()->getJson(route('stock-in.show', $ids['in']))
            ->assertOk()
            ->assertJsonPath('stock_in.branch_id', $this->branchB->id)
            ->assertJsonPath('stock_in.branch.branch_name', 'Second Branch');

        $this->asAdminInBranchA()->getJson(route('stock-out.show', $ids['out']))
            ->assertOk()
            ->assertJsonPath('stock_out.branch_id', $this->branchB->id)
            ->assertJsonPath('stock_out.branch.branch_name', 'Second Branch');

        $this->asAdminInBranchA()->getJson(route('customer-return.show', $ids['ret']))
            ->assertOk()
            ->assertJsonPath('customer_return.branch_id', $this->branchB->id)
            ->assertJsonPath('customer_return.branch.branch_name', 'Second Branch');
    }

    /** AC-29 */
    public function test_receipt_props_include_branch_name(): void
    {
        $ids = $this->seedBranchBTransactions();

        $this->asSuperadminWithoutBranch()->get(route('stock-in.receipt', $ids['in']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('MedicineInventory/StockInReceipt')
                ->where('stockIn.branch_id', $this->branchB->id)
                ->where('stockIn.branch.branch_name', 'Second Branch')
                ->etc());

        $this->asSuperadminWithoutBranch()->get(route('stock-out.receipt', $ids['out']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('MedicineInventory/StockOutReceipt')
                ->where('stockOut.branch.branch_name', 'Second Branch')
                ->etc());

        $this->asSuperadminWithoutBranch()->get(route('customer-return.receipt', $ids['ret']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('MedicineInventory/CustomerReturnReceipt')
                ->where('customerReturn.branch.branch_name', 'Second Branch')
                ->etc());
    }

    /** AC-30 */
    public function test_staff_cannot_view_other_branch_stock_in_or_return(): void
    {
        $ids = $this->seedBranchBTransactions();

        $this->asStaffInBranchA()->getJson(route('stock-in.show', $ids['in']))->assertForbidden();
        $this->asStaffInBranchA()->get(route('stock-in.receipt', $ids['in']))->assertForbidden();
        $this->asStaffInBranchA()->getJson(route('customer-return.show', $ids['ret']))->assertForbidden();
        $this->asStaffInBranchA()->get(route('customer-return.receipt', $ids['ret']))->assertForbidden();
    }

    // ==================================================================
    // Basket data sources
    // ==================================================================

    /** AC-31 */
    public function test_branch_products_endpoint_returns_only_chosen_branch_for_admin_and_superadmin(): void
    {
        ProductQty::create([
            'product_id' => $this->productB->id,
            'quantity' => 30,
            'status' => 'Expired',
            'lot_number' => 'LOT-B-EXP',
            'expiry' => now()->subDay()->toDateString(),
        ]);

        foreach ([fn () => $this->asAdminInBranchA(), fn () => $this->asSuperadminWithoutBranch()] as $as) {
            $response = $as()->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchB->id]))
                ->assertOk();

            $ids = collect($response->json('products'))->pluck('id')->all();
            $this->assertSame([$this->productB->id], $ids);

            $lots = collect($response->json('products.0.batches'))->pluck('lot_number')->all();
            $this->assertSame(['LOT-B-001'], $lots, 'Expired lots must not be offered.');
        }
    }

    /** AC-31 */
    public function test_branch_products_endpoint_blocks_staff_from_other_branch(): void
    {
        $this->asStaffInBranchA()
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchB->id]))
            ->assertForbidden();

        $ids = collect($this->asStaffInBranchA()
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchA->id]))
            ->assertOk()
            ->json('products'))->pluck('id')->all();

        $this->assertSame([$this->product->id], $ids);
    }

    /** AC-32 */
    public function test_customers_for_branch_works_for_admin_and_superadmin_on_other_branch(): void
    {
        $sessions = [
            'admin (session A)' => fn () => $this->asAdminInBranchA(),
            'superadmin (session A)' => fn () => $this->actingAsWithSession($this->superadmin),
            'superadmin (no session branch)' => fn () => $this->asSuperadminWithoutBranch(),
        ];

        foreach ($sessions as $label => $as) {
            $response = $as()->getJson(route('customer-management.for-branch', ['branch_id' => $this->branchB->id]));

            $this->assertSame(200, $response->status(), "{$label}: expected 200, got {$response->status()}");
            $this->assertSame(
                [$this->customerB->customer_id],
                collect($response->json('customers'))->pluck('customer_id')->all(),
                "{$label}: wrong customers",
            );
        }
    }

    /** AC-33 */
    public function test_superadmin_quick_customer_lands_in_chosen_branch(): void
    {
        $response = $this->asSuperadminWithoutBranch()->postJson(route('customer-management.quick-store'), [
            'first_name' => 'Quick',
            'last_name' => 'Bravo',
            'customer_type' => 'Regular',
            'branch_id' => $this->branchB->id,
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('tbl_customers', ['first_name' => 'Quick', 'branch_id' => $this->branchB->id]);
    }

    /** AC-33 */
    public function test_staff_quick_customer_cannot_target_other_branch(): void
    {
        $response = $this->asStaffInBranchA()->postJson(route('customer-management.quick-store'), [
            'first_name' => 'Sneaky',
            'last_name' => 'Staff',
            'customer_type' => 'Regular',
            'branch_id' => $this->branchB->id,
        ]);

        $this->assertNoServerError($response);
        $this->assertDatabaseMissing('tbl_customers', ['first_name' => 'Sneaky', 'branch_id' => $this->branchB->id]);
    }

    /** AC-32 */
    public function test_customers_for_branch_blocks_staff_from_other_branch(): void
    {
        $this->asStaffInBranchA()
            ->getJson(route('customer-management.for-branch', ['branch_id' => $this->branchB->id]))
            ->assertForbidden();

        $this->asStaffInBranchA()
            ->getJson(route('customer-management.for-branch', ['branch_id' => $this->branchA->id]))
            ->assertOk()
            ->assertJsonPath('customers.0.customer_id', $this->customerA->customer_id);
    }
}
