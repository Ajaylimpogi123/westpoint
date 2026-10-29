<?php

namespace Tests\Feature;

use App\Models\BranchCustomer;
use App\Models\InventoryMovementLog;
use App\Models\PosCart;
use App\Models\ProductQty;
use App\Models\Quotation;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockTransfer;
use App\Models\User;
use App\Services\InventoryStockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * Backend coverage for .claude/handoff/qa-fix-batch-1.md.
 */
class QaFixBatch1Test extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();

        config([
            'printer.default' => 'none',
            'printer.branch_printers' => [],
            'printer.printers' => [],
        ]);
    }

    // ── helpers ──────────────────────────────────────────

    private function sell(array $lines, ?User $as = null, string $method = 'cash'): Sale
    {
        $user = $as ?? $this->staff;
        $cart = PosCart::firstOrCreate(['branch_id' => $user->branch_id, 'user_id' => $user->id]);
        $before = (int) (Sale::max('id') ?? 0);

        $this->actingAsWithSession($user)->post('/pos', [
            'cart_id' => $cart->id,
            'items' => array_map(fn ($l) => [
                'product_id' => $this->product->id,
                'unit_type' => $l[1],
                'quantity_sold' => $l[0],
            ], $lines),
            'payment_method' => $method,
            'reference_number' => $method === 'cash' ? null : 'REF-1',
            'discount_amount' => 0,
            'amount_received' => 100000,
            'idempotency_key' => uniqid('pos-', true),
        ])->assertSessionHasNoErrors()->assertSessionHas('success');

        return Sale::where('id', '>', $before)->latest('id')->firstOrFail();
    }

    private function void(Sale $sale, SaleItem $item, int $qty, ?string $key = null)
    {
        return $this->actingAsWithSession($this->staff)->postJson(route('history.void', $sale), array_filter([
            'idempotency_key' => $key,
            'items' => [['sale_item_id' => $item->id, 'quantity_returned' => $qty]],
            'reason' => 'test',
        ], fn ($v) => $v !== null));
    }

    private function customer(int $branchId, string $first = 'Ana'): BranchCustomer
    {
        return BranchCustomer::create([
            'branch_id' => $branchId,
            'first_name' => $first,
            'last_name' => 'Test',
            'customer_type' => 'Regular',
            'status' => 'active',
        ]);
    }

    private function quotationPayload(BranchCustomer $customer): array
    {
        return [
            'customer_id' => $customer->customer_id,
            'qt_date' => now()->toDateString(),
            'delivery_type' => 'pick-up',
            'items' => [[
                'qt_qty' => 1,
                'qt_unit' => 'PIECE',
                'qt_description' => 'Paracetamol',
                'qt_unit_price' => 5,
            ]],
        ];
    }

    // ── session middleware ───────────────────────────────

    public function test_inactive_user_json_request_gets_401_and_is_logged_out(): void
    {
        $this->staff->update(['status' => 'inactive']);

        $this->actingAsWithSession($this->staff->fresh())
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchA->id]))
            ->assertStatus(401)
            ->assertJson(['message' => 'This account has been deactivated. Please contact an administrator.']);

        $this->assertGuest();
    }

    public function test_inactive_user_page_request_redirects_to_login_with_message(): void
    {
        $this->staff->update(['status' => 'inactive']);

        $this->actingAsWithSession($this->staff->fresh())
            ->get('/dashboard')
            ->assertRedirect(route('login'))
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_session_branch_follows_the_users_record(): void
    {
        $this->staff->update(['branch_id' => $this->branchB->id]);

        $this->actingAs($this->staff->fresh())
            ->withSession(['role_id' => 1, 'branch_id' => $this->branchA->id])
            ->get('/dashboard')
            ->assertOk();

        $this->assertSame($this->branchB->id, session('branch_id'));
        $this->assertSame(1, session('role_id'));
    }

    public function test_promoted_user_gets_new_role_without_logging_in_again(): void
    {
        $this->staff->update(['role_id' => 2]);

        $this->actingAs($this->staff->fresh())
            ->withSession(['role_id' => 1, 'branch_id' => $this->branchA->id])
            ->get(route('reports.index'))
            ->assertOk();

        $this->assertSame(2, session('role_id'));
    }

    // ── register ─────────────────────────────────────────

    public function test_admin_register_page_hides_superadmin_role_and_superadmin_sees_it(): void
    {
        $this->actingAsWithSession($this->admin)->get('/register')
            ->assertInertia(fn (Assert $page) => $page->where('roles', fn ($roles) => collect($roles)->pluck('id')->sort()->values()->all() === [1, 2]));

        $this->actingAsWithSession($this->superadmin)->get('/register')
            ->assertInertia(fn (Assert $page) => $page->has('roles', 3));
    }

    public function test_admin_cannot_register_superadmin_but_superadmin_can(): void
    {
        $payload = fn (string $email) => [
            'name' => 'X', 'email' => $email,
            'password' => 'password123', 'password_confirmation' => 'password123',
            'branch_id' => $this->branchA->id, 'role_id' => 3,
        ];

        $this->actingAsWithSession($this->admin)->post('/register', $payload('a@westpoint.test'))
            ->assertSessionHasErrors('role_id');
        $this->assertDatabaseMissing('users', ['email' => 'a@westpoint.test']);

        $this->actingAsWithSession($this->superadmin)->post('/register', $payload('b@westpoint.test'))
            ->assertSessionHasNoErrors();
        $this->assertDatabaseHas('users', ['email' => 'b@westpoint.test', 'role_id' => 3]);
    }

    // ── POS checkout / void ──────────────────────────────

    public function test_checkout_stores_pieces_sold_for_box_and_piece_lines(): void
    {
        $sale = $this->sell([[2, 'Box'], [3, 'Piece']]);

        $this->assertSame(20, (int) $sale->items()->where('unit_type', 'Box')->value('pieces_sold'));
        $this->assertSame(3, (int) $sale->items()->where('unit_type', 'Piece')->value('pieces_sold'));
        $this->assertSame(77, (int) $this->batch->fresh()->quantity);
    }

    public function test_box_void_in_parts_after_pack_size_change_restocks_exactly_what_was_sold(): void
    {
        $sale = $this->sell([[3, 'Box']]);
        $item = $sale->items()->sole();
        $this->assertSame(70, (int) $this->batch->fresh()->quantity);

        $this->product->update(['pack_size' => 12]);

        $this->void($sale, $item, 1)->assertOk();
        $this->assertSame(80, (int) $this->batch->fresh()->quantity);

        $this->void($sale, $item->fresh(), 2)->assertOk();
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame('Voided', $sale->fresh()->status);
    }

    public function test_piece_void_restocks_pieces_and_is_logged(): void
    {
        $sale = $this->sell([[4, 'Piece']]);

        $this->void($sale, $sale->items()->sole(), 4)->assertOk();

        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $log = InventoryMovementLog::where('movement_type', InventoryMovementLog::TYPE_SALE_VOID)->sole();
        $this->assertSame(4, (int) $log->quantity);
        $this->assertSame('LOT-001', $log->lot_number);
        $this->assertSame("Sale {$sale->invoice_number}", $log->reference_label);
    }

    public function test_legacy_box_line_without_pieces_sold_falls_back_to_pack_size(): void
    {
        $sale = $this->sell([[1, 'Box']]);
        $item = $sale->items()->sole();
        $item->update(['pieces_sold' => null]);

        $this->void($sale, $item->fresh(), 1)->assertOk();

        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_void_replay_with_same_key_is_processed_once(): void
    {
        $sale = $this->sell([[5, 'Piece']]);
        $item = $sale->items()->sole();

        $this->void($sale, $item, 2, 'void-key-1')->assertOk()->assertJsonMissing(['already_processed' => true]);
        $this->void($sale, $item->fresh(), 2, 'void-key-1')
            ->assertOk()
            ->assertJson(['already_processed' => true, 'sale' => ['status' => 'Partially Voided']]);

        $this->assertSame(97, (int) $this->batch->fresh()->quantity);
        $this->assertSame(2, (int) $item->fresh()->returned_quantity);
    }

    public function test_rejected_void_releases_the_key(): void
    {
        $sale = $this->sell([[5, 'Piece']]);
        $item = $sale->items()->sole();

        $this->void($sale, $item, 6, 'void-key-2')->assertStatus(422);
        $this->void($sale, $item, 5, 'void-key-2')->assertOk()->assertJsonMissing(['already_processed' => true]);

        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_void_into_expired_lot_keeps_it_expired(): void
    {
        $sale = $this->sell([[5, 'Piece']]);
        $this->batch->update(['status' => ProductQty::STATUS_EXPIRED]);

        $this->void($sale, $sale->items()->sole(), 5)->assertOk();

        $batch = $this->batch->fresh();
        $this->assertSame(ProductQty::STATUS_EXPIRED, $batch->status);
        $this->assertSame(100, (int) $batch->quantity);
        $this->assertSame(0, InventoryStockService::dispensableStock($this->product->id));
    }

    public function test_void_of_deleted_lot_goes_to_a_replacement_lot_with_same_lot_and_expiry(): void
    {
        $sale = $this->sell([[1, 'Box']]);
        $this->actingAsWithSession($this->admin)
            ->delete(route('medicine-inventory.destroy-batch', $this->batch->id));

        $this->void($sale, $sale->items()->sole(), 1)->assertOk();

        $this->assertSame(ProductQty::STATUS_DELETED, $this->batch->fresh()->status);
        $this->assertSame(90, (int) $this->batch->fresh()->quantity);

        $replacement = ProductQty::where('product_id', $this->product->id)->where('id', '!=', $this->batch->id)->sole();
        $this->assertSame('LOT-001', $replacement->lot_number);
        $this->assertSame($this->batch->expiry->toDateString(), $replacement->expiry->toDateString());
        $this->assertSame(10, (int) $replacement->quantity);
        $this->assertSame(ProductQty::STATUS_ACTIVE, $replacement->status);
    }

    public function test_void_for_deactivated_medicine_does_not_reactivate_its_lot(): void
    {
        $sale = $this->sell([[5, 'Piece']]);
        $this->actingAsWithSession($this->admin)
            ->delete(route('medicine-inventory.destroy', $this->product->id));

        $this->void($sale, $sale->items()->sole(), 5)->assertOk();

        $this->assertSame(ProductQty::STATUS_INACTIVE, $this->batch->fresh()->status);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_split_batch_line_returned_piece_by_piece_restores_each_lot(): void
    {
        $this->batch->update(['quantity' => 1, 'expiry' => now()->addDays(10)->toDateString()]);
        $second = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 100,
            'status' => 'Active',
            'lot_number' => 'LOT-002',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $sale = $this->sell([[3, 'Piece']]);
        $item = $sale->items()->sole();

        foreach ([1, 1, 1] as $qty) {
            $this->void($sale, $item->fresh(), $qty)->assertOk();
        }

        $this->assertSame(1, (int) $this->batch->fresh()->quantity);
        $this->assertSame(100, (int) $second->fresh()->quantity);
    }

    // ── quotations ───────────────────────────────────────

    public function test_quotation_gets_customer_branch_and_staff_only_see_their_branch(): void
    {
        $staffB = User::create([
            'name' => 'Staff B', 'email' => 'sb@westpoint.test', 'password' => Hash::make('password'),
            'role_id' => 1, 'branch_id' => $this->branchB->id, 'email_verified_at' => now(),
        ]);

        $this->actingAsWithSession($this->staff)
            ->post('/quotations', $this->quotationPayload($this->customer($this->branchA->id)))
            ->assertSessionHasNoErrors();
        $this->actingAsWithSession($staffB)
            ->post('/quotations', $this->quotationPayload($this->customer($this->branchB->id, 'Ben')))
            ->assertSessionHasNoErrors();

        [$qa, $qb] = Quotation::orderBy('id')->get()->all();
        $this->assertSame($this->branchA->id, (int) $qa->branch_id);
        $this->assertSame($this->branchB->id, (int) $qb->branch_id);

        $this->actingAsWithSession($this->staff)->get('/quotations')
            ->assertInertia(fn (Assert $p) => $p
                ->where('quotations.total', 1)
                ->where('quotations.data.0.id', $qa->id)
                ->where('quotations.data.0.branch.branch_name', 'Main Branch')
                ->where('canFilterBranch', false)
                ->where('branches', []));

        foreach (["/quotations/{$qb->id}", "/quotations/{$qb->id}/edit", "/quotations/{$qb->id}/print"] as $uri) {
            $this->actingAsWithSession($this->staff)->get($uri)->assertNotFound();
        }
        $this->actingAsWithSession($this->staff)
            ->patch("/quotations/{$qb->id}/status", ['status' => 'sent'])->assertNotFound();
        $this->actingAsWithSession($this->staff)
            ->put("/quotations/{$qb->id}", $this->quotationPayload($this->customer($this->branchA->id, 'Cy')))->assertNotFound();
        $this->assertSame('draft', $qb->fresh()->status);
    }

    public function test_admin_sees_all_branches_and_can_filter_by_branch(): void
    {
        foreach ([$this->branchA, $this->branchB] as $branch) {
            Quotation::create([
                'customer_id' => $this->customer($branch->id)->customer_id,
                'branch_id' => $branch->id,
                'qt_no' => 'QF-T-'.$branch->id,
                'qt_date' => now()->toDateString(),
                'delivery_type' => 'pick-up',
                'status' => 'draft',
                'total_amount' => 0,
            ]);
        }

        $this->actingAsWithSession($this->admin)->get('/quotations')
            ->assertInertia(fn (Assert $p) => $p
                ->where('quotations.total', 2)
                ->where('canFilterBranch', true)
                ->has('branches', 2)
                ->where('filters.branch_id', 'all'));

        $this->actingAsWithSession($this->superadmin)->get('/quotations?branch_id='.$this->branchB->id)
            ->assertInertia(fn (Assert $p) => $p
                ->where('quotations.total', 1)
                ->where('quotations.data.0.branch_id', $this->branchB->id));
    }

    // ── medicine restore / transfers ─────────────────────

    public function test_restore_reactivates_stocked_lots_and_logs_it(): void
    {
        $empty = ProductQty::create([
            'product_id' => $this->product->id, 'quantity' => 0, 'status' => 'Inactive',
            'lot_number' => 'LOT-EMPTY', 'expiry' => now()->addYear()->toDateString(),
        ]);

        $this->actingAsWithSession($this->admin)->delete(route('medicine-inventory.destroy', $this->product->id));
        $this->actingAsWithSession($this->admin)->patch(route('medicine-inventory.restore', $this->product->id))
            ->assertSessionHas('success');

        $this->assertSame('Active', $this->product->fresh()->status);
        $this->assertSame('Active', $this->batch->fresh()->status);
        $this->assertSame('Inactive', $empty->fresh()->status);

        $log = InventoryMovementLog::where('movement_type', InventoryMovementLog::TYPE_MEDICINE_REACTIVATED)->sole();
        $this->assertStringContainsString('1 lot(s) with 100 piece(s)', $log->remarks);
    }

    public function test_restore_without_stock_is_refused_clearly(): void
    {
        $this->batch->update(['quantity' => 0, 'status' => 'Inactive']);
        $this->product->update(['status' => 'Deleted']);

        $this->actingAsWithSession($this->admin)->patch(route('medicine-inventory.restore', $this->product->id))
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'no unexpired stock'));

        $this->assertSame('Deleted', $this->product->fresh()->status);
    }

    public function test_transfer_approval_refuses_inactive_lot_without_reactivating_it(): void
    {
        $this->actingAsWithSession($this->staff)->post('/stock-transfers', [
            'to_branch_id' => $this->branchB->id,
            'priority' => 'normal',
            'transfer_date' => now()->toDateString(),
            'items' => [['product_id' => $this->product->id, 'products_qty_id' => $this->batch->id, 'quantity_requested' => 10]],
        ])->assertSessionHasNoErrors();
        $transfer = StockTransfer::sole();

        $this->batch->update(['status' => 'Inactive']);

        $this->actingAsWithSession($this->admin)->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasErrors('status');

        $this->assertSame('Inactive', $this->batch->fresh()->status);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame('pending', $transfer->fresh()->status);
    }

    // ── reports ──────────────────────────────────────────

    public function test_top_products_units_sold_in_pieces_after_partial_box_return(): void
    {
        $sale = $this->sell([[3, 'Box'], [4, 'Piece']]);
        $box = $sale->items()->where('unit_type', 'Box')->sole();
        $this->void($sale, $box, 1)->assertOk();

        $this->actingAsWithSession($this->admin)->get('/reports/top-products')
            ->assertInertia(fn (Assert $p) => $p->where('products.0.units_sold', 24)); // 2 Box x 10 + 4
    }

    public function test_sales_summary_by_day_respects_payment_method(): void
    {
        $this->sell([[1, 'Piece']], null, 'cash');
        $this->sell([[2, 'Piece']], null, 'gcash');

        $this->actingAsWithSession($this->admin)->get('/reports/sales-summary?payment_method=cash')
            ->assertInertia(fn (Assert $p) => $p
                ->where('data.byDay.0.transaction_count', 1)
                ->where('data.totals.transaction_count', 1));
    }

    public function test_expiry_days_to_expiry_uses_app_today(): void
    {
        $this->batch->update(['expiry' => now()->addDays(10)->toDateString()]);

        $this->actingAsWithSession($this->admin)->get('/reports/expiry')
            ->assertInertia(fn (Assert $p) => $p->where('batches.0.days_to_expiry', 10));
    }

    // ── legacy routes (D6) ───────────────────────────────

    public function test_legacy_restaurant_routes_are_gone(): void
    {
        foreach (['/table', '/menu', '/product', '/category', '/order/1/print'] as $uri) {
            $this->actingAsWithSession($this->superadmin)->get($uri)->assertNotFound();
        }
    }
}
