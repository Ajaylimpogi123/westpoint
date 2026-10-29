<?php

namespace Tests\Feature;

use App\Models\InventoryMovementLog;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\StockTransfer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class StockTransferProcessTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    private function payload(array $overrides = [], int $qty = 10): array
    {
        return array_merge([
            'to_branch_id' => $this->branchB->id,
            'priority' => 'normal',
            'transfer_date' => now()->toDateString(),
            'items' => [[
                'product_id' => $this->product->id,
                'products_qty_id' => $this->batch->id,
                'quantity_requested' => $qty,
            ]],
        ], $overrides);
    }

    private function pendingTransfer(int $qty = 10): StockTransfer
    {
        $this->actingAsWithSession($this->staff)
            ->post('/stock-transfers', $this->payload([], $qty))
            ->assertSessionHasNoErrors();

        return StockTransfer::latest('id')->firstOrFail();
    }

    private function branchBProduct(int $qty = 50): array
    {
        $product = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Amlodipine',
            'dose' => '5mg',
            'pack_size' => 10,
            'retail_price' => 2,
            'wholesale_price' => 18,
            'status' => 'Active',
        ]);

        $lot = ProductQty::create([
            'product_id' => $product->id,
            'quantity' => $qty,
            'status' => 'Active',
            'lot_number' => 'LOT-B1',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        return [$product, $lot];
    }

    // ── Who can request from where ──────────────────────

    public function test_admin_can_request_from_another_branch_and_approve_it(): void
    {
        [$product, $lot] = $this->branchBProduct();

        $this->actingAsWithSession($this->admin)
            ->post('/stock-transfers', [
                'from_branch_id' => $this->branchB->id,
                'to_branch_id' => $this->branchA->id,
                'priority' => 'urgent',
                'transfer_date' => now()->toDateString(),
                'items' => [[
                    'product_id' => $product->id,
                    'products_qty_id' => $lot->id,
                    'quantity_requested' => 20,
                ]],
            ])
            ->assertSessionHasNoErrors();

        $transfer = StockTransfer::latest('id')->firstOrFail();
        $this->assertSame($this->branchB->id, (int) $transfer->from_branch_id);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasNoErrors();

        $this->assertSame(30, (int) $lot->fresh()->quantity);
        $this->assertSame(20, (int) ProductQty::query()
            ->whereHas('product', fn ($q) => $q->where('branch_id', $this->branchA->id)->where('med_name', 'Amlodipine'))
            ->sum('quantity'));
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'movement_type' => InventoryMovementLog::TYPE_TRANSFER_OUT,
            'branch_id' => $this->branchB->id,
            'quantity' => -20,
        ]);
    }

    public function test_superadmin_can_request_from_any_branch(): void
    {
        [$product, $lot] = $this->branchBProduct();

        $this->actingAsWithSession($this->superadmin)
            ->post('/stock-transfers', [
                'from_branch_id' => $this->branchB->id,
                'to_branch_id' => $this->branchA->id,
                'priority' => 'normal',
                'transfer_date' => now()->toDateString(),
                'items' => [[
                    'product_id' => $product->id,
                    'products_qty_id' => $lot->id,
                    'quantity_requested' => 5,
                ]],
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('tbl_stock_transfers', [
            'from_branch_id' => $this->branchB->id,
            'requested_by' => $this->superadmin->id,
            'status' => 'pending',
        ]);
    }

    public function test_staff_cannot_request_from_another_branch(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post('/stock-transfers', $this->payload([
                'from_branch_id' => $this->branchB->id,
                'to_branch_id' => $this->branchA->id,
            ]))
            ->assertSessionHasErrors('from_branch_id');

        $this->assertSame(0, StockTransfer::count());
    }

    public function test_transfer_to_the_same_branch_is_rejected(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post('/stock-transfers', $this->payload(['to_branch_id' => $this->branchA->id]))
            ->assertSessionHasErrors('to_branch_id');
    }

    // ── Request validation ──────────────────────────────

    public function test_same_lot_on_two_lines_cannot_exceed_what_the_lot_holds(): void
    {
        // The seeded lot holds 100 pieces.
        $this->actingAsWithSession($this->staff)
            ->post('/stock-transfers', $this->payload([
                'items' => [
                    ['product_id' => $this->product->id, 'products_qty_id' => $this->batch->id, 'quantity_requested' => 60],
                    ['product_id' => $this->product->id, 'products_qty_id' => $this->batch->id, 'quantity_requested' => 60],
                ],
            ]))
            ->assertSessionHasErrors('items');

        $this->assertSame(0, StockTransfer::count());
    }

    // ── Approval safety ─────────────────────────────────

    public function test_second_approval_is_refused_and_stock_moves_once(): void
    {
        $transfer = $this->pendingTransfer(10);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasNoErrors();

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasErrors('status');

        $this->assertSame(90, (int) $this->batch->fresh()->quantity);
        $this->assertSame(1, InventoryMovementLog::where('movement_type', InventoryMovementLog::TYPE_TRANSFER_OUT)->count());
    }

    public function test_approval_refuses_a_lot_that_expired_after_the_request(): void
    {
        $transfer = $this->pendingTransfer(10);

        $this->batch->update(['expiry' => now()->subDay()->toDateString()]);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasErrors('status');

        $this->assertSame('pending', $transfer->fresh()->status);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(0, InventoryMovementLog::whereIn('movement_type', ['transfer_in', 'transfer_out'])->count());
    }

    public function test_cannot_reject_or_cancel_an_approved_transfer(): void
    {
        $transfer = $this->pendingTransfer(10);

        $this->actingAsWithSession($this->admin)->post("/stock-transfers/{$transfer->id}/approve");

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/reject", ['rejection_note' => 'Too late'])
            ->assertSessionHasErrors('status');

        $this->actingAsWithSession($this->staff)
            ->post("/stock-transfers/{$transfer->id}/cancel")
            ->assertSessionHasErrors('status');

        $this->assertSame('approved', $transfer->fresh()->status);
    }

    public function test_requester_can_cancel_pending_request(): void
    {
        $transfer = $this->pendingTransfer(10);

        $this->actingAsWithSession($this->staff)
            ->post("/stock-transfers/{$transfer->id}/cancel")
            ->assertSessionHasNoErrors();

        $this->assertSame('cancelled', $transfer->fresh()->status);
    }

    // ── List page ───────────────────────────────────────

    public function test_superadmin_sees_all_transfers_and_pending_list_read_only(): void
    {
        $this->pendingTransfer(10);

        $this->actingAsWithSession($this->superadmin)
            ->get('/stock-transfers')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('StockTransfer/Index')
                ->has('transfers.data', 1)
                ->has('pendingTransfers', 1)
                ->where('canViewAll', true)
                ->where('canApprove', false)
                ->where('canChooseSource', true));
    }

    public function test_staff_sees_only_own_requests_and_cannot_choose_source(): void
    {
        $this->pendingTransfer(10);

        StockTransfer::create([
            'transfer_no' => 'TR-OTHER-1',
            'from_branch_id' => $this->branchB->id,
            'to_branch_id' => $this->branchA->id,
            'requested_by' => $this->admin->id,
            'status' => 'pending',
            'priority' => 'normal',
            'transfer_date' => now()->toDateString(),
        ]);

        $this->actingAsWithSession($this->staff)
            ->get('/stock-transfers')
            ->assertInertia(fn (Assert $page) => $page
                ->has('transfers.data', 1)
                ->where('canViewAll', false)
                ->where('canChooseSource', false)
                ->where('userBranch', $this->branchA->id));
    }

    public function test_list_search_and_status_filters_run_on_the_server(): void
    {
        $first = $this->pendingTransfer(10);
        $second = $this->pendingTransfer(5);

        $this->actingAsWithSession($this->staff)->post("/stock-transfers/{$second->id}/cancel");

        $this->actingAsWithSession($this->admin)
            ->get('/stock-transfers?status=cancelled')
            ->assertInertia(fn (Assert $page) => $page
                ->has('transfers.data', 1)
                ->where('transfers.data.0.id', $second->id)
                ->where('filters.status', 'cancelled'));

        $this->actingAsWithSession($this->admin)
            ->get('/stock-transfers?search='.$first->transfer_no)
            ->assertInertia(fn (Assert $page) => $page
                ->has('transfers.data', 1)
                ->where('transfers.data.0.id', $first->id));

        $this->actingAsWithSession($this->admin)
            ->get('/stock-transfers?search=parac')
            ->assertInertia(fn (Assert $page) => $page->has('transfers.data', 2));
    }

    public function test_source_products_endpoint_respects_branch_access(): void
    {
        $this->branchBProduct();

        $this->actingAsWithSession($this->admin)
            ->getJson('/stock-transfers/source-products?branch_id='.$this->branchB->id)
            ->assertOk()
            ->assertJsonPath('products.0.med_name', 'Amlodipine')
            ->assertJsonPath('products.0.products_qty.0.lot_number', 'LOT-B1');

        $this->actingAsWithSession($this->staff)
            ->getJson('/stock-transfers/source-products?branch_id='.$this->branchB->id)
            ->assertForbidden();

        $this->actingAsWithSession($this->staff)
            ->getJson('/stock-transfers/source-products?branch_id='.$this->branchA->id)
            ->assertOk();
    }

    public function test_show_redirects_to_filtered_list(): void
    {
        $transfer = $this->pendingTransfer(10);

        $this->actingAsWithSession($this->staff)
            ->get("/stock-transfers/{$transfer->id}")
            ->assertRedirect(route('stock-transfers.index', ['search' => $transfer->transfer_no]));
    }

    // ── Report ──────────────────────────────────────────

    public function test_report_lists_lines_with_moved_and_pending_pieces(): void
    {
        $approved = $this->pendingTransfer(10);
        $this->actingAsWithSession($this->admin)->post("/stock-transfers/{$approved->id}/approve");

        $this->pendingTransfer(7);

        $rejected = $this->pendingTransfer(3);
        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$rejected->id}/reject", ['rejection_note' => 'Not needed']);

        $this->actingAsWithSession($this->admin)
            ->get('/reports/stock-transfers')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/StockTransfers')
                ->has('transfers', 3)
                ->where('totals.transfers', 3)
                ->where('totals.pieces', 10)
                ->where('totals.pending_pieces', 7)
                ->where('transfers', fn ($rows) => collect($rows)->firstWhere('status', 'rejected')['actioned_by_name'] === 'Admin User'
                    && collect($rows)->firstWhere('status', 'rejected')['moved_pieces'] === 0
                    && collect($rows)->firstWhere('status', 'approved')['med_name'] === 'Paracetamol'
                    && collect($rows)->firstWhere('status', 'approved')['from_branch'] === 'Main Branch'));

        $this->actingAsWithSession($this->admin)
            ->get('/reports/stock-transfers?status=pending')
            ->assertInertia(fn (Assert $page) => $page
                ->has('transfers', 1)
                ->where('transfers.0.quantity_requested', 7));
    }
}
