<?php

namespace Tests\Feature\Qa;

use App\Models\Branch;
use App\Models\BranchCustomer;
use App\Models\InventoryMovementLog;
use App\Models\PosCart;
use App\Models\ProductQty;
use App\Models\Quotation;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleReturn;
use App\Models\StockTransfer;
use App\Models\User;
use App\Services\InventoryStockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route as RouteFacade;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * QA for feature qa-fix-batch-1 (contract: .claude/handoff/qa-fix-batch-1.md).
 *
 * Black-box through HTTP routes and the database. Each test names the
 * acceptance criterion (AC-n) it covers. The former test_bug_* tests of this
 * batch were renamed in their original files; this class covers what those
 * tests did not: D1 void idempotency, the restock rules, the quotation branch
 * filter, D2/D3, D6 route removal and D7 timezone.
 */
class QaFixBatch1QaTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    private User $staffB;

    private ?string $originalTimezone = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();

        $this->staffB = User::create([
            'name' => 'Staff B',
            'email' => 'staff-b@westpoint.test',
            'password' => Hash::make('password'),
            'role_id' => 1,
            'branch_id' => $this->branchB->id,
            'email_verified_at' => now(),
        ]);

        config([
            'printer.default' => 'qa-no-printer',
            'printer.branch_printers' => [],
            'printer.printers' => [],
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        if ($this->originalTimezone !== null) {
            config(['app.timezone' => $this->originalTimezone]);
            date_default_timezone_set($this->originalTimezone);
        }

        parent::tearDown();
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private function checkout(User $user, array $items, array $overrides = [])
    {
        $cart = PosCart::firstOrCreate(['branch_id' => $user->branch_id, 'user_id' => $user->id]);

        return $this->actingAsWithSession($user)->post('/pos', array_merge([
            'cart_id' => $cart->id,
            'items' => $items,
            'payment_method' => 'cash',
            'discount_amount' => 0,
            'amount_received' => 100000,
            'idempotency_key' => 'qa-pos-'.uniqid('', true),
        ], $overrides));
    }

    private function line(int $qty, string $unit = 'Piece'): array
    {
        return ['product_id' => $this->product->id, 'unit_type' => $unit, 'quantity_sold' => $qty];
    }

    /** Rings up one line and returns the sale and its single line. */
    private function sell(int $qty, string $unit = 'Piece', ?User $as = null): array
    {
        $this->checkout($as ?? $this->staff, [$this->line($qty, $unit)])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $sale = Sale::query()->latest('id')->firstOrFail();

        return [$sale, $sale->items()->sole()];
    }

    private function void(User $user, Sale $sale, SaleItem $item, int $qty, ?string $key = null, array $extra = [])
    {
        return $this->actingAsWithSession($user)->postJson(route('history.void', $sale), array_merge(array_filter([
            'items' => [['sale_item_id' => $item->id, 'quantity_returned' => $qty]],
            'reason' => 'QA void',
            'idempotency_key' => $key,
        ], fn ($v) => $v !== null), $extra));
    }

    private function makeCustomer(int $branchId, string $first): BranchCustomer
    {
        return BranchCustomer::create([
            'branch_id' => $branchId,
            'first_name' => $first,
            'last_name' => 'QA',
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
                'qt_qty' => 3,
                'qt_unit' => 'PIECE',
                'qt_description' => 'Tablet - Paracetamol 500mg (Bioflu)',
                'qt_unit_price' => 5.00,
            ]],
        ];
    }

    private function createQuotation(User $as, BranchCustomer $customer): Quotation
    {
        $this->actingAsWithSession($as)
            ->post('/quotations', $this->quotationPayload($customer))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('quotations.index'));

        return Quotation::query()->latest('id')->firstOrFail();
    }

    private function quotationIndexProps(User $as, array $query = [], ?array $session = null): array
    {
        $props = null;
        $request = $session === null
            ? $this->actingAsWithSession($as)
            : $this->actingAs($as)->withSession($session);

        $request->get('/quotations'.($query ? '?'.http_build_query($query) : ''))
            ->assertOk()
            ->assertInertia(function (Assert $page) use (&$props) {
                $props = $page->toArray()['props'];
            });

        return $props;
    }

    private function useManilaTimezone(): void
    {
        $this->originalTimezone = config('app.timezone');
        config(['app.timezone' => 'Asia/Manila']);
        date_default_timezone_set('Asia/Manila');
    }

    // ==================================================================
    // AC-1  Register escalation (ACL-1 / ADM-1)
    // ==================================================================

    public function test_ac1_admin_register_of_superadmin_is_a_role_id_validation_error(): void
    {
        $this->actingAsWithSession($this->admin)
            ->from('/register')
            ->post('/register', [
                'name' => 'Escalated',
                'email' => 'escalated@westpoint.test',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'branch_id' => $this->branchA->id,
                'role_id' => 3,
            ])
            ->assertSessionHasErrors(['role_id' => 'Only a superadmin can create superadmin accounts.']);

        $this->assertDatabaseMissing('users', ['email' => 'escalated@westpoint.test']);

        // Admin can still create another admin.
        $this->actingAsWithSession($this->admin)
            ->post('/register', [
                'name' => 'Second Admin',
                'email' => 'admin2@westpoint.test',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'branch_id' => $this->branchB->id,
                'role_id' => 2,
            ])
            ->assertSessionHasNoErrors();
        $this->assertDatabaseHas('users', ['email' => 'admin2@westpoint.test', 'role_id' => 2]);
    }

    public function test_ac1_register_roles_prop_hides_superadmin_from_admin_and_staff_is_forbidden(): void
    {
        $this->actingAsWithSession($this->admin)->get('/register')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Auth/Register')
                ->where('roles', fn ($roles) => collect($roles)->pluck('id')->map('intval')->sort()->values()->all() === [1, 2]));

        $this->actingAsWithSession($this->superadmin)->get('/register')->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('roles', fn ($roles) => collect($roles)->pluck('id')->map('intval')->contains(3)));

        $this->actingAsWithSession($this->staff)->get('/register')->assertForbidden();
        $this->actingAsWithSession($this->staff)->post('/register', [
            'name' => 'x', 'email' => 'x@westpoint.test', 'password' => 'password123',
            'password_confirmation' => 'password123', 'branch_id' => $this->branchA->id, 'role_id' => 1,
        ])->assertForbidden();
        $this->assertDatabaseMissing('users', ['email' => 'x@westpoint.test']);
    }

    // ==================================================================
    // AC-2  Deactivated users lose their session (ACL-2 / ADM-2)
    // ==================================================================

    public function test_ac2_deactivated_user_inertia_request_is_logged_out_to_login(): void
    {
        $this->staff->update(['status' => 'inactive']);

        $this->actingAsWithSession($this->staff->fresh())
            ->get('/pos')
            ->assertRedirect('/login')
            ->assertSessionHasErrors(['email' => 'This account has been deactivated. Please contact an administrator.']);

        $this->assertGuest();
    }

    public function test_ac2_deactivated_user_json_request_gets_401_and_cannot_void_or_sell(): void
    {
        [$sale, $item] = $this->sell(5);
        $this->assertSame(95, (int) $this->batch->fresh()->quantity);

        $this->staff->update(['status' => 'inactive']);

        $this->void($this->staff->fresh(), $sale, $item, 5, 'qa-void-inactive')
            ->assertStatus(401)
            ->assertJson(['message' => 'This account has been deactivated. Please contact an administrator.']);

        $this->checkout($this->staff->fresh(), [$this->line(1)])->assertRedirect('/login');

        $this->assertSame(95, (int) $this->batch->fresh()->quantity);
        $this->assertSame(0, SaleReturn::count());
        $this->assertSame(1, Sale::count());
    }

    // ==================================================================
    // AC-3  Admin / superadmin keep the batch and medicine actions
    // ==================================================================

    public function test_ac3_admin_and_superadmin_keep_batch_and_medicine_actions(): void
    {
        $this->actingAsWithSession($this->admin)
            ->patch(route('medicine-inventory.update-batch', $this->batch->id), [
                'lot_number' => 'LOT-001',
                'expiry' => $this->batch->expiry->format('Y-m-d'),
                'quantity_in_pieces' => 90,
                'adjustment_reason' => 'count correction',
            ])
            ->assertSessionHasNoErrors();
        $this->assertSame(90, (int) $this->batch->fresh()->quantity);

        $this->actingAsWithSession($this->superadmin)
            ->delete(route('medicine-inventory.destroy-batch', $this->batch->id))
            ->assertSessionHasNoErrors();
        $this->assertSame('Deleted', $this->batch->fresh()->status);

        $this->actingAsWithSession($this->superadmin)
            ->delete(route('medicine-inventory.destroy', $this->product->id))
            ->assertSessionHasNoErrors();
        $this->assertSame('Deleted', $this->product->fresh()->status);
    }

    // ==================================================================
    // AC-5  Branch change applies on the next request
    // ==================================================================

    public function test_ac5_staff_moved_to_another_branch_sees_new_branch_with_stale_session(): void
    {
        $customerA = $this->makeCustomer($this->branchA->id, 'Ana');
        $customerB = $this->makeCustomer($this->branchB->id, 'Ben');
        $qa = $this->createQuotation($this->staff, $customerA);
        $qb = $this->createQuotation($this->staffB, $customerB);

        $this->staff->update(['branch_id' => $this->branchB->id]);

        $props = $this->quotationIndexProps($this->staff->fresh(), [], [
            'role_id' => 1,
            'branch_id' => $this->branchA->id, // stale
        ]);

        $ids = collect($props['quotations']['data'])->pluck('id')->all();
        $this->assertSame([$qb->id], $ids, 'Moved staff should see branch B quotations only');
        $this->assertNotContains($qa->id, $ids);
    }

    // ==================================================================
    // AC-6  Quotation branch scoping (QUO-1) and admin filter
    // ==================================================================

    public function test_ac6_new_quotation_stores_the_customer_branch(): void
    {
        $customerB = $this->makeCustomer($this->branchB->id, 'Ben');

        $qa = $this->createQuotation($this->staff, $this->makeCustomer($this->branchA->id, 'Ana'));
        $qb = $this->createQuotation($this->admin, $customerB);

        $this->assertSame($this->branchA->id, (int) $qa->fresh()->branch_id);
        $this->assertSame($this->branchB->id, (int) $qb->fresh()->branch_id);
    }

    public function test_ac6_other_branch_staff_gets_404_on_every_quotation_action(): void
    {
        $customerA = $this->makeCustomer($this->branchA->id, 'Ana');
        $quotation = $this->createQuotation($this->staff, $customerA);
        $before = $quotation->fresh()->toArray();

        $b = fn () => $this->actingAsWithSession($this->staffB);

        $b()->get("/quotations/{$quotation->id}")->assertNotFound();
        $b()->get("/quotations/{$quotation->id}/edit")->assertNotFound();
        $b()->get("/quotations/{$quotation->id}/print")->assertNotFound();
        $b()->put("/quotations/{$quotation->id}", $this->quotationPayload($customerA))->assertNotFound();
        $b()->patch("/quotations/{$quotation->id}/status", ['status' => 'approved'])->assertNotFound();
        $b()->delete("/quotations/{$quotation->id}")->assertNotFound();

        $after = $quotation->fresh();
        $this->assertNotNull($after);
        $this->assertSame($before['status'], $after->status);
        $this->assertSame($before['updated_at'], $after->toArray()['updated_at']);

        // Own branch still works.
        $this->actingAsWithSession($this->staff)->get("/quotations/{$quotation->id}")->assertOk();
    }

    public function test_ac6_admin_branch_filter_and_staff_cannot_widen_scope(): void
    {
        $qa = $this->createQuotation($this->staff, $this->makeCustomer($this->branchA->id, 'Ana'));
        $qb = $this->createQuotation($this->staffB, $this->makeCustomer($this->branchB->id, 'Ben'));

        foreach ([$this->admin, $this->superadmin] as $user) {
            $all = $this->quotationIndexProps($user);
            $this->assertSame(2, (int) $all['quotations']['total']);
            $this->assertTrue($all['canFilterBranch']);
            $this->assertNotEmpty($all['branches']);

            $onlyB = $this->quotationIndexProps($user, ['branch_id' => $this->branchB->id]);
            $this->assertSame([$qb->id], collect($onlyB['quotations']['data'])->pluck('id')->all());
            $this->assertSame($this->branchB->id, (int) $onlyB['quotations']['data'][0]['branch_id']);

            $this->assertSame(2, (int) $this->quotationIndexProps($user, ['branch_id' => 'all'])['quotations']['total']);
        }

        $staff = $this->quotationIndexProps($this->staff, ['branch_id' => $this->branchB->id]);
        $this->assertSame([$qa->id], collect($staff['quotations']['data'])->pluck('id')->all());
        $this->assertFalse($staff['canFilterBranch']);
        $this->assertSame([], $staff['branches']);
    }

    // ==================================================================
    // AC-7  D3: staff may approve quotations
    // ==================================================================

    public function test_ac7_staff_can_approve_own_branch_quotation(): void
    {
        $quotation = $this->createQuotation($this->staff, $this->makeCustomer($this->branchA->id, 'Ana'));

        $this->actingAsWithSession($this->staff)
            ->patch("/quotations/{$quotation->id}/status", ['status' => 'approved'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame('approved', $quotation->fresh()->status);
    }

    // ==================================================================
    // AC-9  POS-1 replay message
    // ==================================================================

    public function test_ac9_checkout_replay_reports_already_completed_and_sells_once(): void
    {
        $key = 'qa-pos-replay';
        $this->checkout($this->staff, [$this->line(2, 'Box')], ['idempotency_key' => $key])
            ->assertSessionHas('success');
        $first = Sale::query()->sole();

        $this->checkout($this->staff, [$this->line(2, 'Box')], ['idempotency_key' => $key])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('pos.index'))
            ->assertSessionHas('success', 'This sale was already completed.');

        $this->assertSame(1, Sale::count());
        $this->assertSame($first->id, Sale::query()->sole()->id);
        $this->assertSame(80, (int) $this->batch->fresh()->quantity);
    }

    // ==================================================================
    // AC-10  Restock rules for locked lots (POS-3, D5)
    // ==================================================================

    public function test_ac10_void_into_deleted_lot_leaves_it_untouched_and_restocks_a_same_lot_copy(): void
    {
        [$sale, $item] = $this->sell(5);

        $this->actingAsWithSession($this->admin)
            ->delete(route('medicine-inventory.destroy-batch', $this->batch->id))
            ->assertSessionHasNoErrors();
        $deletedQty = (int) $this->batch->fresh()->quantity;

        $this->void($this->staff, $sale, $item, 5, 'qa-void-deleted')->assertOk();

        $deleted = $this->batch->fresh();
        $this->assertSame('Deleted', $deleted->status);
        $this->assertSame($deletedQty, (int) $deleted->quantity, 'Deleted lot quantity changed');

        $copy = ProductQty::query()
            ->where('product_id', $this->product->id)
            ->where('id', '!=', $this->batch->id)
            ->sole();
        $this->assertSame('LOT-001', $copy->lot_number);
        $this->assertSame($this->batch->expiry->format('Y-m-d'), $copy->expiry->format('Y-m-d'));
        $this->assertSame(5, (int) $copy->quantity);
        $this->assertSame('Active', $copy->status);
        $this->assertSame(5, InventoryStockService::dispensableStock($this->product->id));

        $log = InventoryMovementLog::query()->where('movement_type', 'sale_void')->sole();
        $this->assertSame(5, (int) $log->quantity);
    }

    public function test_ac10_void_into_expired_lot_keeps_it_expired_and_unsellable(): void
    {
        [$sale, $item] = $this->sell(5);

        // As inventory:expire-batches would leave it.
        $this->batch->update(['expiry' => now()->subDay()->toDateString(), 'status' => 'Expired']);

        $this->void($this->staff, $sale, $item, 5, 'qa-void-expired')->assertOk();

        $lot = $this->batch->fresh();
        $this->assertSame('Expired', $lot->status);
        $this->assertSame(100, (int) $lot->quantity);
        $this->assertSame(1, ProductQty::where('product_id', $this->product->id)->count(), 'no extra lot expected');
        $this->assertSame(0, InventoryStockService::dispensableStock($this->product->id));
        $this->assertSame('Voided', $sale->fresh()->status);
    }

    // ==================================================================
    // AC-11  Box void uses pieces deducted at sale time (POS-4)
    // ==================================================================

    public function test_ac11_partial_box_voids_after_pack_size_change_restock_original_pieces(): void
    {
        [$sale, $item] = $this->sell(3, 'Box');
        $this->assertSame(70, (int) $this->batch->fresh()->quantity);

        $this->product->update(['pack_size' => 12]);

        $this->void($this->staff, $sale, $item, 1, 'qa-box-1')->assertOk();
        $this->assertSame(80, (int) $this->batch->fresh()->quantity);

        $this->void($this->staff, $sale, $item, 2, 'qa-box-2')->assertOk();
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame('Voided', $sale->fresh()->status);
    }

    // ==================================================================
    // AC-12  D1: void idempotency and role/branch access
    // ==================================================================

    public function test_ac12_void_replay_with_same_key_does_not_restock_or_refund_twice(): void
    {
        [$sale, $item] = $this->sell(5);

        $this->void($this->staff, $sale, $item, 2, 'qa-void-k1')
            ->assertOk()
            ->assertJsonMissing(['already_processed' => true]);
        $this->assertSame(97, (int) $this->batch->fresh()->quantity);
        $this->assertSame('10.00', (string) $sale->fresh()->refunded_amount);

        $this->void($this->staff, $sale, $item, 2, 'qa-void-k1')
            ->assertOk()
            ->assertJson([
                'already_processed' => true,
                'message' => 'This void/return was already processed.',
                'sale' => ['id' => $sale->id, 'status' => 'Partially Voided'],
            ]);

        $this->assertSame(97, (int) $this->batch->fresh()->quantity);
        $this->assertSame('10.00', (string) $sale->fresh()->refunded_amount);
        $this->assertSame(2, (int) $item->fresh()->returned_quantity);
        $this->assertSame(1, SaleReturn::count());
        $this->assertSame(1, InventoryMovementLog::query()->where('movement_type', 'sale_void')->count());
    }

    public function test_ac12_box_void_replay_restocks_once(): void
    {
        [$sale, $item] = $this->sell(2, 'Box');

        $this->void($this->staff, $sale, $item, 1, 'qa-void-box')->assertOk();
        $this->void($this->staff, $sale, $item, 1, 'qa-void-box')->assertOk()->assertJson(['already_processed' => true]);

        $this->assertSame(90, (int) $this->batch->fresh()->quantity);
        $this->assertSame(1, (int) $item->fresh()->returned_quantity);
    }

    public function test_ac12_rejected_void_releases_the_key_for_a_corrected_resend(): void
    {
        [$sale, $item] = $this->sell(5);

        // Business rejection: over-return.
        $this->void($this->staff, $sale, $item, 6, 'qa-void-retry')->assertStatus(422);
        // Validation rejection: missing reason.
        $this->void($this->staff, $sale, $item, 2, 'qa-void-retry', ['reason' => ''])->assertStatus(422);
        $this->assertSame(95, (int) $this->batch->fresh()->quantity);
        $this->assertSame(0, SaleReturn::count());

        $this->void($this->staff, $sale, $item, 2, 'qa-void-retry')
            ->assertOk()
            ->assertJsonMissing(['already_processed' => true]);
        $this->assertSame(97, (int) $this->batch->fresh()->quantity);

        $this->void($this->staff, $sale, $item, 2, 'qa-void-retry')->assertOk()->assertJson(['already_processed' => true]);
        $this->assertSame(97, (int) $this->batch->fresh()->quantity);
        $this->assertSame(1, SaleReturn::count());
    }

    public function test_ac12_every_role_voids_in_own_branch_and_other_branch_staff_is_forbidden(): void
    {
        [$sale, $item] = $this->sell(6);

        $this->void($this->staffB, $sale, $item, 1, 'qa-void-b')->assertForbidden();
        $this->assertSame(94, (int) $this->batch->fresh()->quantity);

        $this->void($this->staff, $sale, $item, 1, 'qa-void-s')->assertOk();
        $this->void($this->admin, $sale, $item, 1, 'qa-void-a')->assertOk();
        $this->void($this->superadmin, $sale, $item, 1, 'qa-void-su')->assertOk();

        // The key from the forbidden attempt was not consumed either.
        $this->void($this->staff, $sale, $item, 1, 'qa-void-b')->assertOk()->assertJsonMissing(['already_processed' => true]);

        $this->assertSame(98, (int) $this->batch->fresh()->quantity);
        $this->assertSame(4, (int) $item->fresh()->returned_quantity);
    }

    // ==================================================================
    // AC-13  Restore (INV-2) edge cases
    // ==================================================================

    public function test_ac13_restore_reactivates_stocked_lots_logs_it_and_keeps_expired_locked(): void
    {
        $expired = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 20,
            'status' => 'Expired',
            'lot_number' => 'LOT-OLD',
            'expiry' => now()->subMonth()->toDateString(),
        ]);

        $this->actingAsWithSession($this->admin)
            ->delete(route('medicine-inventory.destroy', $this->product->id))
            ->assertSessionHasNoErrors();
        $this->assertSame('Inactive', $this->batch->fresh()->status);

        $this->actingAsWithSession($this->admin)
            ->patch(route('medicine-inventory.restore', $this->product->id))
            ->assertSessionHas('success', 'Medicine has been restored.');

        $this->assertSame('Active', $this->product->fresh()->status);
        $this->assertSame('Active', $this->batch->fresh()->status);
        $this->assertSame('Expired', $expired->fresh()->status);
        $this->assertSame(100, InventoryStockService::dispensableStock($this->product->id));
        $this->assertSame(1, InventoryMovementLog::query()->where('movement_type', 'medicine_reactivated')->count());
    }

    public function test_ac13_restore_without_unexpired_stock_is_refused(): void
    {
        $this->actingAsWithSession($this->admin)
            ->delete(route('medicine-inventory.destroy', $this->product->id))
            ->assertSessionHasNoErrors();

        // Only stock left has lapsed.
        $this->batch->update(['expiry' => now()->subDay()->toDateString()]);

        $this->actingAsWithSession($this->admin)
            ->patch(route('medicine-inventory.restore', $this->product->id))
            ->assertSessionHas('error');

        $this->assertSame('Deleted', $this->product->fresh()->status);
        $this->assertNotSame('Active', $this->batch->fresh()->status);
    }

    // ==================================================================
    // AC-15  D2: admin approves a transfer they raised
    // ==================================================================

    public function test_ac15_admin_can_approve_own_transfer_and_staff_cannot_approve(): void
    {
        $this->actingAsWithSession($this->admin)->post('/stock-transfers', [
            'from_branch_id' => $this->branchA->id,
            'to_branch_id' => $this->branchB->id,
            'priority' => 'normal',
            'transfer_date' => now()->toDateString(),
            'items' => [[
                'product_id' => $this->product->id,
                'products_qty_id' => $this->batch->id,
                'quantity_requested' => 10,
            ]],
        ])->assertSessionHasNoErrors();

        $transfer = StockTransfer::query()->sole();
        $this->assertSame($this->admin->id, (int) $transfer->requested_by);

        $this->actingAsWithSession($this->staff)
            ->post("/stock-transfers/{$transfer->id}/approve")->assertForbidden();

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertSessionHasNoErrors();

        $this->assertSame('approved', $transfer->fresh()->status);
        $this->assertSame(90, (int) $this->batch->fresh()->quantity);
    }

    // ==================================================================
    // AC-17  Sales summary filter: no filter = all, byDay respects filter
    // ==================================================================

    public function test_ac17_sales_summary_by_day_respects_payment_method_and_no_filter_shows_all(): void
    {
        $this->checkout($this->staff, [$this->line(3)])->assertSessionHas('success');
        $this->checkout($this->staff, [$this->line(1)], ['payment_method' => 'gcash', 'reference_number' => 'G-1'])
            ->assertSessionHas('success');

        $read = function (string $url) {
            $props = null;
            $this->actingAsWithSession($this->admin)->get($url)->assertOk()
                ->assertInertia(function (Assert $page) use (&$props) {
                    $props = $page->toArray()['props'];
                });

            return $props['data'];
        };

        $all = $read('/reports/sales-summary');
        $this->assertSame(2, (int) $all['totals']['transaction_count']);
        $this->assertSame(20.0, round((float) $all['totals']['net_amount'], 2));

        $cash = $read('/reports/sales-summary?payment_method=cash');
        $this->assertSame(1, (int) $cash['totals']['transaction_count']);
        $byDayNet = collect($cash['byDay'])->sum(fn ($d) => (float) ($d['net_amount'] ?? $d['net'] ?? 0));
        $this->assertSame(15.0, round($byDayNet, 2));
    }

    // ==================================================================
    // AC-19  D6 legacy restaurant routes removed
    // ==================================================================

    public function test_ac19_legacy_restaurant_routes_are_404_for_every_role_and_tables_are_kept(): void
    {
        $uris = ['/table', '/menu', '/order', '/product', '/category', '/product/create', '/product/1/edit', '/menu/menu'];

        foreach ([$this->staff, $this->admin, $this->superadmin] as $user) {
            foreach ($uris as $uri) {
                $this->actingAsWithSession($user)->get($uri)->assertNotFound();
            }
            foreach (['/table', '/category', '/product', '/order', '/cart'] as $uri) {
                $this->actingAsWithSession($user)->post($uri, ['t_number' => 9, 'cat_name' => 'X'])->assertNotFound();
            }
        }

        foreach (['bs_table', 'tbl_category', 'tbl_product', 'tbl_cart', 'tbl_order', 'tbl_order_items'] as $table) {
            $this->assertTrue(Schema::hasTable($table), "{$table} was dropped");
        }
        $this->assertFalse(DB::table('bs_table')->where('t_number', 9)->exists());
    }

    public function test_ac19_removed_route_names_are_gone_and_every_remaining_route_has_a_real_action(): void
    {
        $removed = [
            'table.index', 'table.store', 'table.update', 'table.destroy', 'menu.index', 'menu.menu',
            'cart.store', 'cart.destroy', 'cart.update', 'order.place', 'order.print', 'product.index',
            'product.create', 'product.store', 'product.edit', 'product.update', 'product.destroy',
            'category.index', 'category.store', 'category.update', 'category.destroy',
        ];

        foreach ($removed as $name) {
            $this->assertFalse(RouteFacade::has($name), "Route {$name} still registered");
        }

        $checked = 0;
        foreach (RouteFacade::getRoutes() as $route) {
            $action = $route->getActionName();
            if ($action === 'Closure' || ! str_contains($action, '@')) {
                continue;
            }
            [$class, $method] = explode('@', $action);
            $this->assertTrue(class_exists($class), "{$route->uri()} -> missing controller {$class}");
            $this->assertTrue(method_exists($class, $method), "{$route->uri()} -> missing {$class}@{$method}");
            $checked++;
        }
        $this->assertGreaterThan(100, $checked);

        foreach (['pos.index', 'history.index', 'history.void', 'medicine-inventory.destroy', 'quotations.index',
            'stock-transfers.index', 'reports.sales-summary', 'reports.top-products', 'user-management.index',
            'branch-management.index', 'customer-management.index'] as $name) {
            $this->assertTrue(RouteFacade::has($name), "Pharmacy route {$name} missing");
        }
    }

    // ==================================================================
    // AC-20  D7 timezone
    // ==================================================================

    public function test_ac20_app_timezone_defaults_to_asia_manila_when_env_is_unset(): void
    {
        $saved = [getenv('APP_TIMEZONE'), $_ENV['APP_TIMEZONE'] ?? null, $_SERVER['APP_TIMEZONE'] ?? null];

        putenv('APP_TIMEZONE');
        unset($_ENV['APP_TIMEZONE'], $_SERVER['APP_TIMEZONE']);

        try {
            $config = require config_path('app.php');
        } finally {
            if ($saved[0] !== false) {
                putenv('APP_TIMEZONE='.$saved[0]);
            }
            if ($saved[1] !== null) {
                $_ENV['APP_TIMEZONE'] = $saved[1];
            }
            if ($saved[2] !== null) {
                $_SERVER['APP_TIMEZONE'] = $saved[2];
            }
        }

        $this->assertSame('Asia/Manila', $config['timezone']);
    }

    public function test_ac20_timestamp_shift_migration_round_trips_and_leaves_date_columns_alone(): void
    {
        $files = glob(database_path('migrations/62_*.php'));
        $this->assertCount(1, $files, 'migration 62 not found');
        $migration = require $files[0];

        $transfer = StockTransfer::create([
            'transfer_no' => 'TR-QA-TZ',
            'from_branch_id' => $this->branchA->id,
            'to_branch_id' => $this->branchB->id,
            'requested_by' => $this->staff->id,
            'status' => 'approved',
            'priority' => 'normal',
            'transfer_date' => '2026-03-01',
            'needed_by' => '2026-03-05',
        ]);

        DB::table('tbl_stock_transfers')->where('id', $transfer->id)->update([
            'created_at' => '2026-03-01 20:00:00',
            'updated_at' => '2026-03-01 20:00:00',
            'approved_at' => '2026-03-01 23:30:00',
        ]);
        DB::table('products_qty')->where('id', $this->batch->id)->update([
            'created_at' => '2026-01-15 10:00:00',
            'updated_at' => '2026-01-15 10:00:00',
            'expiry' => '2027-03-01',
        ]);
        DB::table('users')->where('id', $this->staff->id)->update(['email_verified_at' => null]);

        $snapshot = fn () => [
            'tr' => (array) DB::table('tbl_stock_transfers')->where('id', $transfer->id)
                ->first(['created_at', 'updated_at', 'approved_at', 'transfer_date', 'needed_by']),
            'lot' => (array) DB::table('products_qty')->where('id', $this->batch->id)
                ->first(['created_at', 'updated_at', 'expiry']),
            'user' => DB::table('users')->where('id', $this->staff->id)->value('email_verified_at'),
            'branch_deleted' => DB::table('branches')->where('id', $this->branchA->id)->value('deleted_at'),
        ];

        $original = $snapshot();

        $migration->down();
        $down = $snapshot();
        $this->assertSame('2026-03-01 12:00:00', $down['tr']['created_at']);
        $this->assertSame('2026-03-01 15:30:00', $down['tr']['approved_at']);
        $this->assertSame('2026-01-15 02:00:00', $down['lot']['created_at']);

        $migration->up();
        $this->assertSame($original, $snapshot(), 'down() then up() is not an exact round trip');

        $migration->up();
        $up = $snapshot();
        $this->assertSame('2026-03-02 04:00:00', $up['tr']['created_at'], 'datetime crossing midnight');
        $this->assertSame('2026-03-02 07:30:00', $up['tr']['approved_at']);
        $this->assertSame('2026-01-15 18:00:00', $up['lot']['created_at']);
        $migration->down();
        $this->assertSame($original, $snapshot(), 'up() then down() is not an exact round trip');

        // DATE columns and NULLs untouched throughout.
        foreach ([$down, $up] as $state) {
            $this->assertSame('2026-03-01', $state['tr']['transfer_date']);
            $this->assertSame('2026-03-05', $state['tr']['needed_by']);
            $this->assertSame('2027-03-01', $state['lot']['expiry']);
            $this->assertNull($state['user']);
            $this->assertNull($state['branch_deleted']);
        }
    }

    public function test_ac20_report_today_boundary_uses_manila_date(): void
    {
        $this->useManilaTimezone();

        // 23:30 Manila on the 20th (15:30 UTC).
        Carbon::setTestNow(Carbon::parse('2026-10-20 15:30:00', 'UTC')->setTimezone('Asia/Manila'));
        $this->checkout($this->staff, [$this->line(1)])->assertSessionHas('success');

        // 00:30 Manila on the 21st (16:30 UTC on the 20th).
        Carbon::setTestNow(Carbon::parse('2026-10-20 16:30:00', 'UTC')->setTimezone('Asia/Manila'));
        $this->checkout($this->staff, [$this->line(2)])->assertSessionHas('success');

        $late = Sale::query()->latest('id')->firstOrFail();
        $this->assertSame('2026-10-21 00:30:00', DB::table('tbl_sales')->where('id', $late->id)->value('created_at'));

        $props = null;
        $this->actingAsWithSession($this->admin)->get('/reports/sales-summary')->assertOk()
            ->assertInertia(function (Assert $page) use (&$props) {
                $props = $page->toArray()['props'];
            });

        $this->assertSame(1, (int) $props['data']['totals']['transaction_count'], 'Today (Manila 21st) should hold only the 00:30 sale');
        $this->assertSame(10.0, round((float) $props['data']['totals']['net_amount'], 2));
    }
}
