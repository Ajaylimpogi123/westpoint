<?php

namespace Tests\Feature\Qa;

use App\Models\BranchCustomer;
use App\Models\InventoryMovementLog;
use App\Models\MedicineProduct;
use App\Models\PosCart;
use App\Models\PosCartItem;
use App\Models\ProductQty;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleItemAllocation;
use App\Models\User;
use App\Services\InventoryStockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * QA pass over POS checkout, receipts and Order History void/return.
 *
 * Black-box through HTTP routes and the database. Tests named test_bug_* are
 * regression tests for confirmed defects and FAIL until the defect is fixed.
 */
class PosSalesQaTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();

        // No physical printer in tests: make ReceiptPrinterService find no
        // profile so it returns false instead of touching a COM port.
        config([
            'printer.default' => 'qa-no-printer',
            'printer.branch_printers' => [],
            'printer.printers' => [],
        ]);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private function cartFor(User $user): PosCart
    {
        return PosCart::firstOrCreate([
            'branch_id' => $user->branch_id,
            'user_id' => $user->id,
        ]);
    }

    private function checkout(User $user, array $items, array $overrides = [])
    {
        $cart = $this->cartFor($user);

        return $this->actingAsWithSession($user)->post('/pos', array_merge([
            'cart_id' => $cart->id,
            'items' => $items,
            'payment_method' => 'cash',
            'discount_amount' => 0,
            'amount_received' => 100000,
        ], $overrides));
    }

    private function line(int $qty, string $unit = 'Piece', ?int $productId = null, array $extra = []): array
    {
        return array_merge([
            'product_id' => $productId ?? $this->product->id,
            'unit_type' => $unit,
            'quantity_sold' => $qty,
        ], $extra);
    }

    private function onlySale(): Sale
    {
        return Sale::query()->sole();
    }

    private function voidLine(User $user, Sale $sale, SaleItem $item, int $qty)
    {
        return $this->actingAsWithSession($user)->postJson(route('history.void', $sale), [
            'items' => [['sale_item_id' => $item->id, 'quantity_returned' => $qty]],
            'reason' => 'QA void',
        ]);
    }

    // ------------------------------------------------------------------
    // Checkout: pricing, units, VAT, discounts
    // ------------------------------------------------------------------

    public function test_every_role_can_checkout_in_own_branch(): void
    {
        foreach ([$this->staff, $this->admin, $this->superadmin] as $user) {
            $this->checkout($user, [$this->line(1)])
                ->assertSessionHasNoErrors()
                ->assertRedirect(route('pos.index'))
                ->assertSessionHas('success');
        }

        $this->assertSame(3, Sale::query()->where('branch_id', $this->branchA->id)->count());
        $this->assertSame(97, (int) $this->batch->fresh()->quantity);
    }

    public function test_vat_item_box_and_piece_prices_include_12_percent(): void
    {
        $this->product->update(['vat_status' => 'VAT']);

        // 1 Box @ 45.00*1.12 = 50.40, 3 Piece @ 5.00*1.12 = 5.60 -> 16.80
        $this->checkout($this->staff, [$this->line(1, 'Box'), $this->line(3, 'Piece')])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $sale = $this->onlySale();
        $this->assertSame('67.20', (string) $sale->gross_amount);
        $this->assertSame('67.20', (string) $sale->net_amount);

        $box = $sale->items()->where('unit_type', 'Box')->sole();
        $piece = $sale->items()->where('unit_type', 'Piece')->sole();
        $this->assertSame('50.40', (string) $box->price_used);
        $this->assertSame('5.60', (string) $piece->price_used);
        $this->assertSame('16.80', (string) $piece->total_price);

        // 10 + 3 pieces deducted from storage (pieces only).
        $this->assertSame(87, (int) $this->batch->fresh()->quantity);
    }

    public function test_discounted_vat_exempt_line_uses_base_price_and_exemption_needs_discount(): void
    {
        $this->product->update(['vat_status' => 'VAT']);

        $this->checkout($this->staff, [
            // discounted + exempt: 45.00 base, 20% off = 9.00
            $this->line(1, 'Box', null, ['apply_discount' => true, 'vat_exempt' => true]),
            // exempt flag without discount must be ignored: 5.60 VAT price
            $this->line(1, 'Piece', null, ['apply_discount' => false, 'vat_exempt' => true]),
        ], [
            'discount_percent' => 20,
            'discount_type' => 'Senior Citizen',
        ])->assertSessionHasNoErrors()->assertSessionHas('success');

        $sale = $this->onlySale();
        $box = $sale->items()->where('unit_type', 'Box')->sole();
        $piece = $sale->items()->where('unit_type', 'Piece')->sole();

        $this->assertTrue((bool) $box->vat_exempt);
        $this->assertSame('45.00', (string) $box->price_used);
        $this->assertSame('9.00', (string) $box->discount_amount);
        $this->assertFalse((bool) $piece->vat_exempt);
        $this->assertSame('5.60', (string) $piece->price_used);
        $this->assertSame('0.00', (string) $piece->discount_amount);

        $this->assertSame('50.60', (string) $sale->gross_amount);
        $this->assertSame('9.00', (string) $sale->discount_amount);
        $this->assertSame('41.60', (string) $sale->net_amount);
    }

    public function test_zero_negative_fractional_and_over_limit_quantities_are_rejected(): void
    {
        foreach ([0, -1, 1.5, InventoryStockService::MAX_TRANSACTION_QUANTITY + 1] as $bad) {
            $this->checkout($this->staff, [$this->line(1, 'Piece', null, ['quantity_sold' => $bad])])
                ->assertSessionHasErrors('items.0.quantity_sold');
        }

        $this->checkout($this->staff, [$this->line(1, 'Carton')])
            ->assertSessionHasErrors('items.0.unit_type');

        $this->assertSame(0, Sale::query()->count());
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_insufficient_stock_rolls_back_and_releases_idempotency_key(): void
    {
        // 11 boxes = 110 pieces > 100 on hand.
        $this->checkout($this->staff, [$this->line(11, 'Box')], ['idempotency_key' => 'qa-pos-insufficient'])
            ->assertSessionHas('error');

        $this->assertSame(0, Sale::query()->count());
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);

        // Same key after correcting the quantity must go through.
        $this->checkout($this->staff, [$this->line(10, 'Box')], ['idempotency_key' => 'qa-pos-insufficient'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame(1, Sale::query()->count());
        $this->assertSame(0, (int) $this->batch->fresh()->quantity);
    }

    public function test_expired_batch_is_not_sellable_and_fefo_skips_it(): void
    {
        $this->batch->update(['expiry' => now()->subDay()->toDateString()]);

        $this->checkout($this->staff, [$this->line(1)])->assertSessionHas('error');
        $this->assertSame(0, Sale::query()->count());
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);

        $fresh = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 20,
            'status' => 'Active',
            'lot_number' => 'LOT-FRESH',
            'expiry' => now()->addMonths(6)->toDateString(),
        ]);

        $this->checkout($this->staff, [$this->line(5)])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame(100, (int) $this->batch->fresh()->quantity, 'expired lot must not be touched');
        $this->assertSame(15, (int) $fresh->fresh()->quantity);
    }

    public function test_product_of_another_branch_cannot_be_sold_or_added_to_cart(): void
    {
        $other = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Amoxicillin',
            'pack_size' => 10,
            'retail_price' => 8,
            'wholesale_price' => 70,
            'status' => 'Active',
        ]);
        $otherBatch = ProductQty::create([
            'product_id' => $other->id,
            'quantity' => 50,
            'status' => 'Active',
            'lot_number' => 'B-1',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $this->checkout($this->staff, [$this->line(1, 'Piece', $other->id)])
            ->assertSessionHas('error');

        $this->actingAsWithSession($this->staff)
            ->postJson(route('pos.cart.items.store'), ['product_id' => $other->id, 'unit_type' => 'Piece'])
            ->assertNotFound();

        $this->assertSame(0, Sale::query()->count());
        $this->assertSame(50, (int) $otherBatch->fresh()->quantity);
    }

    public function test_invoice_numbers_are_sequential_per_branch(): void
    {
        $this->checkout($this->staff, [$this->line(1)])->assertSessionHas('success');
        $this->checkout($this->staff, [$this->line(1)])->assertSessionHas('success');

        $date = now()->format('Ymd');
        $numbers = Sale::query()->orderBy('id')->pluck('invoice_number')->all();

        $this->assertSame([
            "POS-{$this->branchA->id}-{$date}-00001",
            "POS-{$this->branchA->id}-{$date}-00002",
        ], $numbers);
    }

    // ------------------------------------------------------------------
    // Cart (server-side stock ceiling in pieces)
    // ------------------------------------------------------------------

    public function test_cart_box_quantity_is_capped_by_pieces_on_hand(): void
    {
        $this->actingAsWithSession($this->staff)
            ->postJson(route('pos.cart.items.store'), ['product_id' => $this->product->id, 'unit_type' => 'Piece'])
            ->assertOk();

        $item = PosCartItem::query()->sole();

        // 15 pieces fine, switching that line to Box = 150 pieces > 100.
        $this->actingAsWithSession($this->staff)
            ->patchJson(route('pos.cart.items.update', $item), ['quantity_sold' => 15])
            ->assertOk();
        $this->actingAsWithSession($this->staff)
            ->patchJson(route('pos.cart.items.update', $item), ['unit_type' => 'Box'])
            ->assertStatus(422);

        // 10 boxes = 100 pieces OK; 11 boxes rejected.
        $this->actingAsWithSession($this->staff)
            ->patchJson(route('pos.cart.items.update', $item), ['quantity_sold' => 10])
            ->assertOk();
        $this->actingAsWithSession($this->staff)
            ->patchJson(route('pos.cart.items.update', $item), ['unit_type' => 'Box'])
            ->assertOk();
        $this->actingAsWithSession($this->staff)
            ->patchJson(route('pos.cart.items.update', $item), ['quantity_sold' => 11])
            ->assertStatus(422);

        $this->assertSame('Box', $item->fresh()->unit_type);
        $this->assertSame(10, (int) $item->fresh()->quantity_sold);
    }

    public function test_cart_item_of_another_user_is_forbidden(): void
    {
        $this->actingAsWithSession($this->admin)
            ->postJson(route('pos.cart.items.store'), ['product_id' => $this->product->id, 'unit_type' => 'Piece'])
            ->assertOk();
        $adminItem = PosCartItem::query()->sole();

        $this->actingAsWithSession($this->staff)
            ->patchJson(route('pos.cart.items.update', $adminItem), ['quantity_sold' => 5])
            ->assertForbidden();
        $this->actingAsWithSession($this->staff)
            ->deleteJson(route('pos.cart.items.destroy', $adminItem))
            ->assertForbidden();

        $this->assertSame(1, (int) $adminItem->fresh()->quantity_sold);
    }

    // ------------------------------------------------------------------
    // Order History scoping
    // ------------------------------------------------------------------

    public function test_history_and_invoice_of_other_branch_are_forbidden(): void
    {
        $this->checkout($this->staff, [$this->line(2)])->assertSessionHas('success');
        $sale = $this->onlySale();

        $staffB = User::create([
            'name' => 'Staff B',
            'email' => 'staff-b@westpoint.test',
            'password' => bcrypt('password'),
            'role_id' => 1,
            'branch_id' => $this->branchB->id,
            'email_verified_at' => now(),
        ]);

        $this->actingAsWithSession($staffB)->get(route('history.show', $sale))->assertForbidden();
        $this->actingAsWithSession($staffB)->get(route('history.print', $sale))->assertForbidden();
        $this->actingAsWithSession($staffB)->get(route('history.returnable', $sale))->assertForbidden();
        $this->actingAsWithSession($staffB)->get(route('pos.sales.invoice', $sale))->assertForbidden();
        $this->actingAsWithSession($staffB)
            ->postJson(route('history.void', $sale), [
                'items' => [['sale_item_id' => $sale->items()->value('id'), 'quantity_returned' => 1]],
                'reason' => 'cross-branch',
            ])->assertForbidden();

        $this->actingAsWithSession($staffB)->get(route('history.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('History/Index')->has('sales', 0));

        $this->assertSame(98, (int) $this->batch->fresh()->quantity);
        $this->assertSame('Completed', $sale->fresh()->status);
    }

    // ------------------------------------------------------------------
    // Void / return
    // ------------------------------------------------------------------

    public function test_full_void_of_box_line_restocks_pieces_and_refunds_net(): void
    {
        $this->checkout($this->staff, [$this->line(2, 'Box')])->assertSessionHas('success');
        $sale = $this->onlySale();
        $item = $sale->items()->sole();
        $this->assertSame(80, (int) $this->batch->fresh()->quantity);

        $this->voidLine($this->staff, $sale, $item, 2)->assertOk();

        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $sale->refresh();
        $this->assertSame('Voided', $sale->status);
        $this->assertSame((string) $sale->net_amount, (string) $sale->refunded_amount);

        // Nothing left to return.
        $this->voidLine($this->staff, $sale, $item, 1)->assertStatus(422);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_full_void_of_split_batch_box_line_restores_each_lot(): void
    {
        $this->batch->update(['quantity' => 6, 'expiry' => now()->addDays(7)->toDateString()]);
        $second = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 200,
            'status' => 'Active',
            'lot_number' => 'LOT-002',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $this->checkout($this->staff, [$this->line(2, 'Box')])->assertSessionHas('success');
        $sale = $this->onlySale();
        $item = $sale->items()->sole();
        $this->assertSame(0, (int) $this->batch->fresh()->quantity);
        $this->assertSame(186, (int) $second->fresh()->quantity);

        $this->voidLine($this->staff, $sale, $item, 2)->assertOk();

        $this->assertSame(6, (int) $this->batch->fresh()->quantity);
        $this->assertSame('Active', $this->batch->fresh()->status);
        $this->assertSame(200, (int) $second->fresh()->quantity);
    }

    public function test_partial_void_sets_partially_voided_and_rejects_over_return(): void
    {
        $this->checkout($this->staff, [$this->line(5)])->assertSessionHas('success');
        $sale = $this->onlySale();
        $item = $sale->items()->sole();

        $this->voidLine($this->staff, $sale, $item, 6)->assertStatus(422);
        $this->voidLine($this->staff, $sale, $item, 0)->assertStatus(422);
        $this->assertSame(95, (int) $this->batch->fresh()->quantity);

        $this->voidLine($this->staff, $sale, $item, 2)->assertOk();
        $this->assertSame(97, (int) $this->batch->fresh()->quantity);
        $this->assertSame('Partially Voided', $sale->fresh()->status);
        $this->assertSame('10.00', (string) $sale->fresh()->refunded_amount);
    }

    // ------------------------------------------------------------------
    // Confirmed defects (these FAIL until fixed)
    // ------------------------------------------------------------------

    /**
     * POS-1: a retry of an already-committed checkout (same idempotency_key)
     * is rejected by validation because the cart was deleted by the first
     * request, so the cashier is told the sale failed although it went through.
     */
    public function test_bug_pos1_duplicate_checkout_after_commit_is_reported_as_failure(): void
    {
        $cart = $this->cartFor($this->staff);
        $payload = [
            'idempotency_key' => 'qa-pos1-dup',
            'cart_id' => $cart->id,
            'items' => [$this->line(2)],
            'payment_method' => 'cash',
            'discount_amount' => 0,
            'amount_received' => 10,
        ];

        $this->actingAsWithSession($this->staff)->post('/pos', $payload)
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $retry = $this->actingAsWithSession($this->staff)->post('/pos', $payload);

        $this->assertSame(1, Sale::query()->count());
        $this->assertSame(98, (int) $this->batch->fresh()->quantity);

        // Expected: recognised as a duplicate of a completed sale.
        $retry->assertSessionHasNoErrors();
        $retry->assertSessionHas('success');
    }

    /**
     * POS-2: ReceiptPrinterService::printReceipt() returns false (it never
     * throws) when the printer is missing/unreachable, but PosController
     * ignores the return value and always reports the receipt as printed.
     */
    public function test_bug_pos2_receipt_reported_printed_when_printer_unavailable(): void
    {
        $response = $this->checkout($this->staff, [$this->line(1)]);

        $response->assertSessionHas('receipt_printed', false);
        $this->assertStringContainsString('did not print', (string) session('success'));
    }

    /**
     * POS-3: voiding a sale whose batch was later deleted flips the Deleted
     * batch back to Active, resurrecting its whole remaining quantity as
     * sellable stock (bypasses InventoryStockService's locked statuses).
     */
    public function test_bug_pos3_void_resurrects_deleted_batch(): void
    {
        $this->checkout($this->staff, [$this->line(5)])->assertSessionHas('success');
        $sale = $this->onlySale();
        $item = $sale->items()->sole();

        $this->actingAsWithSession($this->admin)
            ->delete(route('medicine-inventory.destroy-batch', $this->batch->id))
            ->assertSessionHas('success');
        $this->assertSame('Deleted', $this->batch->fresh()->status);
        $this->assertSame(0, InventoryStockService::dispensableStock($this->product->id));

        $this->voidLine($this->staff, $sale, $item, 5)->assertOk();

        // At most the 5 returned pieces may become sellable; the 95 pieces the
        // admin removed must stay removed.
        $this->assertSame('Deleted', $this->batch->fresh()->status);
        $this->assertLessThanOrEqual(5, InventoryStockService::dispensableStock($this->product->id));
    }

    /**
     * POS-4: void converts returned boxes with the product's CURRENT pack_size,
     * not the one the sale deducted with. pack_size is editable (min:1), so
     * after a 10 -> 12 change, returning 1 box restocks 12 pieces for 10 sold.
     */
    public function test_bug_pos4_box_void_after_pack_size_change_restocks_wrong_pieces(): void
    {
        $this->checkout($this->staff, [$this->line(1, 'Box')])->assertSessionHas('success');
        $sale = $this->onlySale();
        $item = $sale->items()->sole();
        $this->assertSame(90, (int) $this->batch->fresh()->quantity);

        // Admin edits the pack size afterwards (allowed by medicine update rules).
        $this->product->update(['pack_size' => 12]);

        $this->voidLine($this->staff, $sale, $item, 1)->assertOk();

        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    /**
     * POS-5: partial returns of a split-batch line are distributed with floor()
     * per return, so after returning a line piece by piece the last lot is
     * over-credited and the earlier-expiry lot never gets its stock back.
     */
    public function test_bug_pos5_piecewise_void_of_split_line_misallocates_lots(): void
    {
        $this->batch->update(['quantity' => 1, 'expiry' => now()->addDays(10)->toDateString()]);
        $second = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 100,
            'status' => 'Active',
            'lot_number' => 'LOT-002',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        // 3 pieces: 1 from LOT-001, 2 from LOT-002.
        $this->checkout($this->staff, [$this->line(3)])->assertSessionHas('success');
        $sale = $this->onlySale();
        $item = $sale->items()->sole();
        $this->assertSame(2, SaleItemAllocation::query()->where('sale_item_id', $item->id)->count());

        foreach ([1, 1, 1] as $qty) {
            $this->voidLine($this->staff, $sale, $item, $qty)->assertOk();
        }

        $this->assertSame('Voided', $sale->fresh()->status);
        // Each lot should be back to exactly what it held before the sale.
        $this->assertSame(1, (int) $this->batch->fresh()->quantity, 'LOT-001 under-credited');
        $this->assertSame(100, (int) $second->fresh()->quantity, 'LOT-002 over-credited');
    }

    /**
     * POS-6: refund = round(net_line / qty, 2) * qty_returned. When the
     * discounted line total does not divide evenly, a full void refunds more
     * than the customer paid.
     */
    public function test_bug_pos6_full_void_refund_exceeds_amount_paid(): void
    {
        $this->product->update(['retail_price' => 10.01]);

        // 3 x 10.01 = 30.03; 20% = 6.006 -> 6.01; net 24.02.
        $this->checkout($this->staff, [$this->line(3, 'Piece', null, ['apply_discount' => true])], [
            'discount_percent' => 20,
            'discount_type' => 'Senior Citizen',
            'amount_received' => 30,
        ])->assertSessionHas('success');

        $sale = $this->onlySale();
        $this->assertSame('24.02', (string) $sale->net_amount);

        $this->voidLine($this->staff, $sale, $sale->items()->sole(), 3)->assertOk();

        $sale->refresh();
        $this->assertSame('Voided', $sale->status);
        $this->assertSame('24.02', (string) $sale->refunded_amount);
    }

    /**
     * POS-7: POS sales and voids move stock but write nothing to
     * tbl_inventory_movement_logs, so the Movement Ledger report misses the
     * most frequent stock movement in the system.
     */
    public function test_bug_pos7_sale_and_void_are_missing_from_movement_ledger(): void
    {
        $this->checkout($this->staff, [$this->line(4)])->assertSessionHas('success');
        $sale = $this->onlySale();

        $afterSale = InventoryMovementLog::query()->where('pd_id', $this->product->id)->count();

        $this->voidLine($this->staff, $sale, $sale->items()->sole(), 4)->assertOk();

        $afterVoid = InventoryMovementLog::query()->where('pd_id', $this->product->id)->count();

        $this->assertGreaterThanOrEqual(1, $afterSale, 'POS sale not logged');
        $this->assertGreaterThan($afterSale, $afterVoid, 'Void restock not logged');
    }

    /**
     * POS-8: checkout accepts a customer_id from another branch for staff,
     * although updateCart/searchCustomers restrict staff to their branch.
     */
    public function test_bug_pos8_staff_checkout_accepts_customer_from_other_branch(): void
    {
        $foreign = BranchCustomer::create([
            'branch_id' => $this->branchB->id,
            'first_name' => 'Other',
            'last_name' => 'Branch',
            'customer_type' => 'Regular',
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);

        $this->checkout($this->staff, [$this->line(1)], ['customer_id' => $foreign->customer_id]);

        $this->assertSame(
            0,
            Sale::query()->where('customer_id', $foreign->customer_id)->count(),
            'Branch A staff sale was linked to a Branch B customer'
        );
    }
}
