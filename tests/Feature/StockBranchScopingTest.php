<?php

namespace Tests\Feature;

use App\Models\BranchCustomer;
use App\Models\CustomerReturn;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\StockIn;
use App\Models\StockOut;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * Stock In / Stock Out / Customer Return must be scoped to the branch chosen
 * on the form: admins/superadmins pick any branch (with or without a session
 * branch), staff are locked to theirs, and every item must come from the
 * chosen branch.
 */
class StockBranchScopingTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    private MedicineProduct $productB;

    private ProductQty $batchB;

    private BranchCustomer $customerA;

    private BranchCustomer $customerB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
        $this->withoutVite();

        $this->productB = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Amlodipine',
            'dose' => '5mg',
            'form' => 'Tablet',
            'pack_size' => 12,
            'retail_price' => 2,
            'wholesale_price' => 20,
            'status' => 'Active',
        ]);

        $this->batchB = ProductQty::create([
            'product_id' => $this->productB->id,
            'quantity' => 500,
            'status' => 'Active',
            'lot_number' => 'LOT-B1',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $this->customerA = $this->makeCustomer($this->branchA->id, 'Ana');
        $this->customerB = $this->makeCustomer($this->branchB->id, 'Ben');
    }

    // ---------------------------------------------------------------- helpers

    private function makeCustomer(int $branchId, string $firstName): BranchCustomer
    {
        return BranchCustomer::create([
            'branch_id' => $branchId,
            'first_name' => $firstName,
            'last_name' => 'Cruz',
            'customer_type' => 'Regular',
            'status' => 'active',
        ]);
    }

    private function actingWithoutSessionBranch(User $user)
    {
        return $this->actingAs($user)->withSession([
            'role_id' => $user->role_id,
            'branch_id' => null,
        ]);
    }

    private function stockInPayload(int $branchId, int $pdId, array $item = [], array $extra = []): array
    {
        return array_merge([
            'supplier_name' => 'Acme Pharma',
            'delivery_date' => now()->toDateString(),
            'branch_id' => $branchId,
            'received_by' => 'Receiver',
            'items' => [array_merge([
                'pd_id' => $pdId,
                'batch_number' => 'LOT-NEW',
                'expiry_date' => now()->addYears(2)->toDateString(),
                'quantity_received' => 2,
                'unit_type' => 'Box',
            ], $item)],
        ], $extra);
    }

    private function stockOutPayload(int $branchId, int $pdId, int $batchId, array $item = [], array $extra = []): array
    {
        return array_merge([
            'transaction_subtype' => 'Returned to supplier',
            'branch_id' => $branchId,
            'issued_by' => 'Issuer',
            'items' => [array_merge([
                'pd_id' => $pdId,
                'products_qty_id' => $batchId,
                'quantity_deducted' => 2,
                'unit_type' => 'Box',
                'pieces_per_box' => 12,
            ], $item)],
        ], $extra);
    }

    private function returnPayload(int $branchId, int $customerId, int $pdId, array $item = []): array
    {
        return [
            'customer_id' => $customerId,
            'return_date' => now()->toDateString(),
            'branch_id' => $branchId,
            'received_by' => 'Receiver',
            'items' => [array_merge([
                'pd_id' => $pdId,
                'batch_number' => 'LOT-RET',
                'expiry_date' => now()->addYears(2)->toDateString(),
                'quantity_received' => 2,
                'unit_type' => 'Box',
            ], $item)],
        ];
    }

    // --------------------------------------------------------------- stock in

    public function test_admin_with_other_session_branch_can_stock_in_to_chosen_branch_in_boxes(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->productB->id, [], [
                'idempotency_key' => 'si-admin-b',
            ]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $stockIn = StockIn::firstOrFail();
        $this->assertSame($this->branchB->id, (int) $stockIn->branch_id);

        // 2 boxes x pack_size 12 = 24 pieces in a new branch-B lot.
        $this->assertDatabaseHas('products_qty', [
            'product_id' => $this->productB->id,
            'lot_number' => 'LOT-NEW',
            'quantity' => 24,
        ]);
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'pd_id' => $this->productB->id,
            'branch_id' => $this->branchB->id,
            'quantity' => 24,
        ]);
    }

    public function test_superadmin_without_session_branch_can_stock_in_in_pieces(): void
    {
        $this->actingWithoutSessionBranch($this->superadmin)
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->productB->id, [
                'quantity_received' => 7,
                'unit_type' => 'Piece',
            ]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame($this->branchB->id, (int) StockIn::firstOrFail()->branch_id);
        $this->assertDatabaseHas('products_qty', [
            'product_id' => $this->productB->id,
            'lot_number' => 'LOT-NEW',
            'quantity' => 7,
        ]);
    }

    public function test_stock_in_rejects_medicine_from_another_branch_and_keeps_idempotency_key(): void
    {
        // Stale basket: branch switched to B but the line is a branch-A medicine.
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->product->id, [], [
                'idempotency_key' => 'si-stale',
            ]))
            ->assertSessionHasErrors('items.0.pd_id');

        $this->assertDatabaseCount('tbl_stock_ins', 0);
        $this->assertSame(1, ProductQty::where('product_id', $this->product->id)->count());

        // Same key, corrected basket: must go through, not be treated as a repeat.
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->productB->id, [], [
                'idempotency_key' => 'si-stale',
            ]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', 'Stock-in transaction recorded successfully.');

        $this->assertDatabaseCount('tbl_stock_ins', 1);
    }

    public function test_stock_in_rejects_deactivated_medicine(): void
    {
        $this->productB->update(['status' => 'Deleted']);

        $this->actingAsWithSession($this->admin)
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->productB->id))
            ->assertSessionHasErrors('items.0.pd_id');

        $this->assertDatabaseCount('tbl_stock_ins', 0);
    }

    public function test_staff_stock_in_to_other_branch_is_a_validation_error(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->productB->id))
            ->assertSessionHasErrors('branch_id');

        $this->assertDatabaseCount('tbl_stock_ins', 0);
        $this->assertSame(500, (int) $this->batchB->fresh()->quantity);
    }

    public function test_staff_without_session_branch_is_forbidden(): void
    {
        $this->actingWithoutSessionBranch($this->staff)
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchA->id, $this->product->id))
            ->assertForbidden();

        $this->actingWithoutSessionBranch($this->staff)
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchA->id, $this->product->id, $this->batch->id))
            ->assertForbidden();

        $this->actingWithoutSessionBranch($this->staff)
            ->post(route('customer-return.store'), $this->returnPayload($this->branchA->id, $this->customerA->customer_id, $this->product->id))
            ->assertForbidden();
    }

    public function test_staff_can_stock_in_own_branch_in_boxes(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchA->id, $this->product->id))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('products_qty', [
            'product_id' => $this->product->id,
            'lot_number' => 'LOT-NEW',
            'quantity' => 20,
        ]);
    }

    public function test_stock_in_rejects_soft_deleted_branch(): void
    {
        $this->branchB->delete();

        $this->actingAsWithSession($this->admin)
            ->post(route('stock-in.store'), $this->stockInPayload($this->branchB->id, $this->productB->id))
            ->assertSessionHasErrors('branch_id');
    }

    // -------------------------------------------------------------- stock out

    public function test_admin_without_session_branch_can_stock_out_from_chosen_branch_in_boxes(): void
    {
        $this->actingWithoutSessionBranch($this->admin)
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id, [], [
                'idempotency_key' => 'so-admin-b',
            ]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame($this->branchB->id, (int) StockOut::firstOrFail()->branch_id);
        $this->assertSame(500 - 24, (int) $this->batchB->fresh()->quantity);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'pd_id' => $this->productB->id,
            'branch_id' => $this->branchB->id,
            'quantity' => -24,
        ]);
    }

    public function test_stock_out_in_pieces_from_other_branch(): void
    {
        $this->actingAsWithSession($this->superadmin)
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id, [
                'quantity_deducted' => 5,
                'unit_type' => 'Piece',
                'pieces_per_box' => null,
            ]))
            ->assertSessionHasNoErrors();

        $this->assertSame(495, (int) $this->batchB->fresh()->quantity);
    }

    public function test_stock_out_rejects_medicine_from_another_branch(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->product->id, $this->batch->id))
            ->assertSessionHasErrors('items.0.pd_id');

        $this->assertDatabaseCount('tbl_stock_outs', 0);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_stock_out_rejects_lot_from_another_branch(): void
    {
        // Branch-B medicine paired with a branch-A lot id (crafted payload).
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batch->id))
            ->assertSessionHasErrors('items.0.products_qty_id');

        $this->assertDatabaseCount('tbl_stock_outs', 0);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(500, (int) $this->batchB->fresh()->quantity);
    }

    public function test_stock_out_rejects_expired_lot_as_validation_error(): void
    {
        $this->batchB->update(['expiry' => now()->subDay()->toDateString()]);

        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id))
            ->assertSessionHasErrors('items.0.products_qty_id');

        $this->assertDatabaseCount('tbl_stock_outs', 0);
    }

    public function test_staff_stock_out_from_other_branch_is_a_validation_error(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id))
            ->assertSessionHasErrors('branch_id');

        $this->assertSame(500, (int) $this->batchB->fresh()->quantity);
    }

    public function test_delivery_edit_update_and_confirm_use_the_stock_out_branch(): void
    {
        $this->actingWithoutSessionBranch($this->superadmin)
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id, [], [
                'transaction_subtype' => 'Delivery to Customer',
                'delivered_to' => 'ABC Clinic',
            ]))
            ->assertSessionHasNoErrors();

        $stockOut = StockOut::firstOrFail();
        $this->assertSame(500, (int) $this->batchB->fresh()->quantity);

        // Admin whose session is branch A edits a branch-B delivery.
        $this->actingAsWithSession($this->admin)
            ->getJson(route('stock-out.edit', $stockOut))
            ->assertOk()
            ->assertJsonPath('stock_out.branch_id', $this->branchB->id)
            ->assertJsonPath('stock_out.branch', ['id' => $this->branchB->id, 'branch_name' => 'Second Branch']);

        $updatePayload = [
            'issued_by' => 'Issuer',
            'delivered_to' => 'ABC Clinic',
            'items' => [[
                'pd_id' => $this->product->id,
                'products_qty_id' => $this->batch->id,
                'quantity_deducted' => 1,
                'unit_type' => 'Piece',
            ]],
        ];

        // Branch-A items cannot be put on a branch-B stock-out.
        $this->actingAsWithSession($this->admin)
            ->put(route('stock-out.update', $stockOut), $updatePayload)
            ->assertSessionHasErrors('items.0.pd_id');

        $updatePayload['items'][0] = [
            'pd_id' => $this->productB->id,
            'products_qty_id' => $this->batchB->id,
            'quantity_deducted' => 3,
            'unit_type' => 'Box',
            'pieces_per_box' => 12,
        ];

        $this->actingAsWithSession($this->admin)
            ->put(route('stock-out.update', $stockOut), $updatePayload)
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->actingWithoutSessionBranch($this->admin)
            ->post(route('stock-out.confirm-delivery', $stockOut))
            ->assertSessionHas('success');

        $this->assertSame(500 - 36, (int) $this->batchB->fresh()->quantity);
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'pd_id' => $this->productB->id,
            'branch_id' => $this->branchB->id,
            'quantity' => -36,
        ]);
        $this->assertDatabaseHas('tbl_sales', [
            'branch_id' => $this->branchB->id,
            'reference_number' => "Stock Out #{$stockOut->stock_out_id}",
        ]);
    }

    public function test_confirm_delivery_refuses_lot_that_expired_after_recording(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), $this->stockOutPayload($this->branchB->id, $this->productB->id, $this->batchB->id, [], [
                'transaction_subtype' => 'Delivery to Customer',
                'delivered_to' => 'ABC Clinic',
            ]))
            ->assertSessionHasNoErrors();

        $stockOut = StockOut::firstOrFail();
        $this->batchB->update(['expiry' => now()->subDay()->toDateString()]);

        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.confirm-delivery', $stockOut))
            ->assertSessionHas('error');

        $this->assertSame(500, (int) $this->batchB->fresh()->quantity);
        $this->assertFalse((bool) $stockOut->fresh()->delivery_confirmed);
        $this->assertDatabaseCount('tbl_sales', 0);
        $this->assertDatabaseCount('tbl_inventory_movement_logs', 0);
    }

    public function test_staff_cannot_touch_other_branch_stock_out(): void
    {
        $stockOut = StockOut::create([
            'transaction_subtype' => 'Delivery to Customer',
            'branch_id' => $this->branchB->id,
            'issued_by' => 'Issuer',
        ]);

        $staff = $this->actingAsWithSession($this->staff);

        $staff->getJson(route('stock-out.show', $stockOut))->assertForbidden();
        $staff->get(route('stock-out.receipt', $stockOut))->assertForbidden();
        $staff->getJson(route('stock-out.edit', $stockOut))->assertForbidden();
        $staff->put(route('stock-out.update', $stockOut), ['issued_by' => 'x', 'items' => []])->assertForbidden();
        $staff->post(route('stock-out.confirm-delivery', $stockOut))->assertForbidden();
    }

    // -------------------------------------------------------- customer return

    public function test_superadmin_without_session_branch_can_record_return_for_chosen_branch(): void
    {
        $this->actingWithoutSessionBranch($this->superadmin)
            ->post(route('customer-return.store'), $this->returnPayload(
                $this->branchB->id,
                $this->customerB->customer_id,
                $this->productB->id,
            ))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame($this->branchB->id, (int) CustomerReturn::firstOrFail()->branch_id);
        $this->assertDatabaseHas('products_qty', [
            'product_id' => $this->productB->id,
            'lot_number' => 'LOT-RET',
            'quantity' => 24,
        ]);
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'pd_id' => $this->productB->id,
            'branch_id' => $this->branchB->id,
            'quantity' => 24,
        ]);
    }

    public function test_return_rejects_customer_from_another_branch(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post(route('customer-return.store'), $this->returnPayload(
                $this->branchB->id,
                $this->customerA->customer_id,
                $this->productB->id,
            ))
            ->assertSessionHasErrors('customer_id');

        $this->assertDatabaseCount('tbl_returns', 0);
    }

    public function test_return_rejects_medicine_from_another_branch(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post(route('customer-return.store'), $this->returnPayload(
                $this->branchB->id,
                $this->customerB->customer_id,
                $this->product->id,
                ['unit_type' => 'Piece', 'quantity_received' => 3],
            ))
            ->assertSessionHasErrors('items.0.pd_id');

        $this->assertDatabaseCount('tbl_returns', 0);
    }

    public function test_staff_return_to_other_branch_is_a_validation_error(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post(route('customer-return.store'), $this->returnPayload(
                $this->branchB->id,
                $this->customerB->customer_id,
                $this->productB->id,
            ))
            ->assertSessionHasErrors('branch_id');

        $this->assertDatabaseCount('tbl_returns', 0);
    }

    // ------------------------------------------------ show / receipt / index

    public function test_show_endpoints_expose_branch_for_admin_without_session_branch(): void
    {
        $stockIn = StockIn::create([
            'supplier_name' => 'Acme', 'delivery_date' => now()->toDateString(),
            'branch_id' => $this->branchB->id, 'received_by' => 'R',
        ]);
        $stockOut = StockOut::create([
            'transaction_subtype' => 'Returned to supplier',
            'branch_id' => $this->branchB->id, 'issued_by' => 'I',
        ]);
        $return = CustomerReturn::create([
            'customer_id' => $this->customerB->customer_id, 'return_date' => now()->toDateString(),
            'branch_id' => $this->branchB->id, 'received_by' => 'R',
        ]);

        $expected = ['id' => $this->branchB->id, 'branch_name' => 'Second Branch'];
        $client = $this->actingWithoutSessionBranch($this->admin);

        $client->getJson(route('stock-in.show', $stockIn))->assertOk()
            ->assertJsonPath('stock_in.branch_id', $this->branchB->id)
            ->assertJsonPath('stock_in.branch', $expected);
        $client->getJson(route('stock-out.show', $stockOut))->assertOk()
            ->assertJsonPath('stock_out.branch_id', $this->branchB->id)
            ->assertJsonPath('stock_out.branch', $expected);
        $client->getJson(route('customer-return.show', $return))->assertOk()
            ->assertJsonPath('customer_return.branch_id', $this->branchB->id)
            ->assertJsonPath('customer_return.branch', $expected);

        // Staff from branch A is still locked out.
        $staff = $this->actingAsWithSession($this->staff);
        $staff->getJson(route('stock-in.show', $stockIn))->assertForbidden();
        $staff->getJson(route('customer-return.show', $return))->assertForbidden();
        $staff->get(route('stock-in.receipt', $stockIn))->assertForbidden();
        $staff->get(route('customer-return.receipt', $return))->assertForbidden();
    }

    public function test_receipts_expose_branch_summary(): void
    {
        $stockIn = StockIn::create([
            'supplier_name' => 'Acme', 'delivery_date' => now()->toDateString(),
            'branch_id' => $this->branchB->id, 'received_by' => 'R',
        ]);
        $stockOut = StockOut::create([
            'transaction_subtype' => 'Returned to supplier',
            'branch_id' => $this->branchB->id, 'issued_by' => 'I',
        ]);
        $return = CustomerReturn::create([
            'customer_id' => $this->customerB->customer_id, 'return_date' => now()->toDateString(),
            'branch_id' => $this->branchB->id, 'received_by' => 'R',
        ]);

        // Branch soft-deleted after the fact: the receipt still names it.
        $this->branchB->delete();

        $expected = ['id' => $this->branchB->id, 'branch_name' => 'Second Branch'];
        $client = $this->actingWithoutSessionBranch($this->superadmin);

        $client->get(route('stock-in.receipt', $stockIn))
            ->assertInertia(fn (Assert $page) => $page
                ->component('MedicineInventory/StockInReceipt')
                ->where('stockIn.branch', $expected));
        $client->get(route('stock-out.receipt', $stockOut))
            ->assertInertia(fn (Assert $page) => $page
                ->component('MedicineInventory/StockOutReceipt')
                ->where('stockOut.branch', $expected));
        $client->get(route('customer-return.receipt', $return))
            ->assertInertia(fn (Assert $page) => $page
                ->component('MedicineInventory/CustomerReturnReceipt')
                ->where('customerReturn.branch', $expected));
    }

    public function test_index_history_rows_always_include_branch(): void
    {
        StockIn::create([
            'supplier_name' => 'Acme', 'delivery_date' => now()->toDateString(),
            'branch_id' => $this->branchB->id, 'received_by' => 'R',
        ]);
        StockOut::create([
            'transaction_subtype' => 'Returned to supplier',
            'branch_id' => $this->branchB->id, 'issued_by' => 'I',
        ]);
        CustomerReturn::create([
            'customer_id' => $this->customerB->customer_id, 'return_date' => now()->toDateString(),
            'branch_id' => $this->branchB->id, 'received_by' => 'R',
        ]);

        $expected = ['id' => $this->branchB->id, 'branch_name' => 'Second Branch'];

        // Filtered to a single branch: previously the relation was dropped here.
        $this->actingAsWithSession($this->admin)
            ->get(route('medicine-inventory.index', [
                'stock_in_branch_id' => $this->branchB->id,
                'stock_out_branch_id' => $this->branchB->id,
                'return_branch_id' => $this->branchB->id,
            ]))
            ->assertInertia(fn (Assert $page) => $page
                ->component('MedicineInventory/Index')
                ->where('stockIns.data.0.branch', $expected)
                ->where('stockOuts.data.0.branch', $expected)
                ->where('customerReturns.data.0.branch', $expected));

        // Admin with no session branch, unfiltered.
        $this->actingWithoutSessionBranch($this->admin)
            ->get(route('medicine-inventory.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('stockIns.data.0.branch', $expected)
                ->where('stockOuts.data.0.branch', $expected)
                ->where('customerReturns.data.0.branch', $expected));
    }

    public function test_index_history_includes_branch_for_staff(): void
    {
        StockIn::create([
            'supplier_name' => 'Acme', 'delivery_date' => now()->toDateString(),
            'branch_id' => $this->branchA->id, 'received_by' => 'R',
        ]);

        $this->actingAsWithSession($this->staff)
            ->get(route('medicine-inventory.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('stockIns.data', 1)
                ->where('stockIns.data.0.branch', ['id' => $this->branchA->id, 'branch_name' => 'Main Branch']));
    }

    // --------------------------------------- branch product / customer lists

    public function test_branch_products_scoped_to_requested_branch(): void
    {
        $this->actingWithoutSessionBranch($this->admin)
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchB->id]))
            ->assertOk()
            ->assertJsonCount(1, 'products')
            ->assertJsonPath('products.0.id', $this->productB->id)
            ->assertJsonPath('products.0.batches.0.id', $this->batchB->id);

        // Staff load their own branch through the same endpoint.
        $this->actingAsWithSession($this->staff)
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchA->id]))
            ->assertOk()
            ->assertJsonCount(1, 'products')
            ->assertJsonPath('products.0.id', $this->product->id);

        $this->actingAsWithSession($this->staff)
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchB->id]))
            ->assertForbidden();

        $this->actingWithoutSessionBranch($this->staff)
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchA->id]))
            ->assertForbidden();
    }

    public function test_customers_for_branch_allows_admin_and_superadmin_for_any_branch(): void
    {
        foreach ([$this->admin, $this->superadmin] as $user) {
            $this->actingWithoutSessionBranch($user)
                ->getJson(route('customer-management.for-branch', ['branch_id' => $this->branchB->id]))
                ->assertOk()
                ->assertJsonCount(1, 'customers')
                ->assertJsonPath('customers.0.customer_id', $this->customerB->customer_id);
        }

        $this->actingAsWithSession($this->staff)
            ->getJson(route('customer-management.for-branch', ['branch_id' => $this->branchB->id]))
            ->assertForbidden();
    }

    public function test_superadmin_quick_store_creates_customer_in_chosen_branch(): void
    {
        $this->actingWithoutSessionBranch($this->superadmin)
            ->postJson(route('customer-management.quick-store'), [
                'first_name' => 'Cara',
                'last_name' => 'Diaz',
                'customer_type' => 'Regular',
                'branch_id' => $this->branchB->id,
            ])
            ->assertCreated()
            ->assertJsonPath('customer.branch_id', $this->branchB->id);
    }
}
