<?php

namespace Tests\Feature\Qa;

use App\Models\InventoryMovementLog;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\StockOut;
use App\Models\StockOutItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * Black-box acceptance tests for feature `stock-out-validation-basket`.
 * Criteria ids (AC-n) refer to `.claude/handoff/stock-out-validation-basket.md`.
 *
 * Fixtures: LOT-001 = 100 pieces of Paracetamol (pack_size 10, retail 5.00,
 * wholesale 45.00) in branch A.
 */
class StockOutValidationBasketTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    private const MAX = 1_000_000;

    protected MedicineProduct $productB;

    protected ProductQty $batchB;

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
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private function recipient(): array
    {
        return [
            'delivered_to' => 'ABC Clinic',
            'delivered_to_address' => 'Lacson St, Bacolod City',
        ];
    }

    private function payload(string $subtype, array $items, array $extra = []): array
    {
        $base = [
            'transaction_subtype' => $subtype,
            'branch_id' => $this->branchA->id,
            'issued_by' => 'Issuer',
            'idempotency_key' => 'qa-so-'.uniqid('', true),
            'items' => $items,
        ];

        if ($subtype === 'Delivery to Customer') {
            $base = array_merge($base, $this->recipient());
        }

        return array_merge($base, $extra);
    }

    private function piece(int|float|string|null $qty, ?ProductQty $lot = null, ?MedicineProduct $product = null): array
    {
        return [
            'pd_id' => ($product ?? $this->product)->id,
            'products_qty_id' => ($lot ?? $this->batch)->id,
            'quantity_deducted' => $qty,
            'unit_type' => 'Piece',
        ];
    }

    private function box(int|float|string|null $qty, ?int $piecesPerBox = 10, ?ProductQty $lot = null, ?MedicineProduct $product = null): array
    {
        $line = [
            'pd_id' => ($product ?? $this->product)->id,
            'products_qty_id' => ($lot ?? $this->batch)->id,
            'quantity_deducted' => $qty,
            'unit_type' => 'Box',
        ];

        if ($piecesPerBox !== null) {
            $line['pieces_per_box'] = $piecesPerBox;
        }

        return $line;
    }

    private function store(User $user, array $payload): TestResponse
    {
        return $this->actingAsWithSession($user)
            ->from(route('medicine-inventory.index'))
            ->post(route('stock-out.store'), $payload);
    }

    private function update(User $user, StockOut $stockOut, array $payload): TestResponse
    {
        return $this->actingAsWithSession($user)
            ->from(route('medicine-inventory.index'))
            ->put(route('stock-out.update', $stockOut), $payload);
    }

    /** A pending "Delivery to Customer" stock-out of 5 pieces from LOT-001. */
    private function pendingDelivery(): StockOut
    {
        $this->store($this->admin, $this->payload('Delivery to Customer', [$this->piece(5)]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        return StockOut::query()->latest('stock_out_id')->firstOrFail();
    }

    private function updatePayload(array $items, array $extra = []): array
    {
        return array_merge([
            'issued_by' => 'Issuer',
        ], $this->recipient(), ['items' => $items], $extra);
    }

    /**
     * AC-15: line error exists on `items.<i>.<field>` and its message is
     * readable: mentions "Line <i+1>" and does not leak the raw attribute.
     */
    private function assertLineError(TestResponse $response, int $index, string $field): void
    {
        $key = "items.{$index}.{$field}";
        $response->assertSessionHasErrors($key);

        $messages = session('errors')->get($key);
        $this->assertNotEmpty($messages, "No message for {$key}");

        foreach ($messages as $message) {
            $this->assertStringContainsString('Line '.($index + 1), $message, "Message for {$key} is not line-numbered: {$message}");
            $this->assertStringNotContainsString('items.'.$index, $message, "Message for {$key} leaks the raw attribute: {$message}");
        }
    }

    /** AC-18: every outcome is success, validation errors, or a non-empty flash.error. */
    private function assertExplicitOutcome(TestResponse $response): void
    {
        $hasErrors = session()->has('errors') && session('errors')->any();
        $success = session('success');
        $error = session('error');

        $this->assertTrue(
            $hasErrors || filled($success) || filled($error),
            'Response ended with no flash.success, no flash.error and no validation errors (silent outcome).'
        );
    }

    private function assertNothingWritten(int $lotPieces = 100): void
    {
        $this->assertSame(0, StockOut::count(), 'A stock-out header was written');
        $this->assertSame(0, StockOutItem::count(), 'Stock-out items were written');
        $this->assertSame($lotPieces, (int) $this->batch->fresh()->quantity, 'Lot quantity changed');
    }

    private function idempotencyKeyClaimed(string $key): bool
    {
        return DB::table('tbl_idempotency_keys')
            ->where('scope', 'stock_out')
            ->where('idempotency_key', $key)
            ->exists();
    }

    // ------------------------------------------------------------------
    // AC-1 / AC-2 / AC-3 happy paths and unit conversion
    // ------------------------------------------------------------------

    public function test_ac1_piece_delivery_to_customer_saves_and_does_not_deduct_yet(): void
    {
        $response = $this->store($this->admin, $this->payload('Delivery to Customer', [$this->piece(5)]));

        $response->assertSessionHasNoErrors()->assertSessionHas('success');
        $this->assertSame(1, StockOut::count());

        $stockOut = StockOut::firstOrFail();
        $this->assertSame($this->branchA->id, (int) $stockOut->branch_id);

        $item = StockOutItem::firstOrFail();
        $this->assertSame(5, (int) $item->quantity_deducted);
        $this->assertSame(5, (int) $item->pieces_deducted);
        $this->assertSame('Piece', $item->unit_type);
        $this->assertEquals(5.00, (float) $item->unit_price);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_ac2_box_return_to_supplier_converts_to_pieces_and_deducts_once(): void
    {
        $response = $this->store($this->admin, $this->payload('Returned to supplier', [$this->box(2, 10)]));

        $response->assertSessionHasNoErrors()->assertSessionHas('success');

        $item = StockOutItem::firstOrFail();
        $this->assertSame(2, (int) $item->quantity_deducted);
        $this->assertSame(20, (int) $item->pieces_deducted);
        $this->assertSame('Box', $item->unit_type);
        $this->assertSame(10, (int) $item->pieces_per_box);
        $this->assertEquals(45.00, (float) $item->unit_price);

        $this->assertSame(80, (int) $this->batch->fresh()->quantity);

        $logs = InventoryMovementLog::where('movement_type', InventoryMovementLog::TYPE_STOCK_OUT)->get();
        $this->assertCount(1, $logs);
        $this->assertSame(-20, (int) $logs->first()->quantity);
    }

    public function test_ac3_box_exactly_filling_the_lot_is_accepted(): void
    {
        $this->store($this->admin, $this->payload('Returned to supplier', [$this->box(10, 10)]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame(0, (int) $this->batch->fresh()->quantity);
    }

    public function test_ac3_box_over_the_lot_after_conversion_is_refused_on_the_line(): void
    {
        // 11 boxes x 10 = 110 pieces > 100; 11 < 100 so a unit-blind check would pass.
        $response = $this->store($this->admin, $this->payload('Delivery to Customer', [$this->box(11, 10)]));

        $this->assertLineError($response, 0, 'quantity_deducted');
        $this->assertNothingWritten();
    }

    // ------------------------------------------------------------------
    // AC-4 roles and branch
    // ------------------------------------------------------------------

    public function test_ac4_staff_can_store_for_own_branch(): void
    {
        $this->store($this->staff, $this->payload('Delivery to Customer', [$this->piece(3)]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame($this->branchA->id, (int) StockOut::firstOrFail()->branch_id);
    }

    public function test_ac4_staff_cannot_store_for_another_branch(): void
    {
        $response = $this->store($this->staff, $this->payload('Delivery to Customer', [
            $this->piece(3, $this->batchB, $this->productB),
        ], ['branch_id' => $this->branchB->id]));

        $response->assertSessionHasErrors('branch_id');
        $this->assertSame(0, StockOut::count());
        $this->assertSame(200, (int) $this->batchB->fresh()->quantity);
    }

    public function test_ac4_staff_without_session_branch_is_forbidden(): void
    {
        $this->actingAs($this->staff)
            ->withSession(['role_id' => 1, 'branch_id' => null])
            ->post(route('stock-out.store'), $this->payload('Delivery to Customer', [$this->piece(3)]))
            ->assertForbidden();

        $this->assertSame(0, StockOut::count());
    }

    public function test_ac4_admin_and_superadmin_choose_the_source_branch(): void
    {
        foreach ([$this->admin, $this->superadmin] as $user) {
            $this->store($user, $this->payload('Returned to supplier', [
                $this->piece(10, $this->batchB, $this->productB),
            ], ['branch_id' => $this->branchB->id]))
                ->assertSessionHasNoErrors()
                ->assertSessionHas('success');
        }

        $this->assertSame(2, StockOut::where('branch_id', $this->branchB->id)->count());
        $this->assertSame(180, (int) $this->batchB->fresh()->quantity);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    // ------------------------------------------------------------------
    // AC-5 header fields
    // ------------------------------------------------------------------

    public function test_ac5_required_header_fields(): void
    {
        $payload = $this->payload('Delivery to Customer', [$this->piece(3)]);
        unset($payload['transaction_subtype'], $payload['branch_id'], $payload['issued_by']);

        $this->store($this->admin, $payload)
            ->assertSessionHasErrors(['transaction_subtype', 'branch_id', 'issued_by']);

        $this->assertNothingWritten();
    }

    public function test_ac5_blank_issued_by_and_unknown_subtype_and_branch_are_refused(): void
    {
        $this->store($this->admin, $this->payload('Delivery to Customer', [$this->piece(3)], [
            'issued_by' => '   ',
            'transaction_subtype' => 'Given away',
            'branch_id' => 999999,
        ]))->assertSessionHasErrors(['issued_by', 'transaction_subtype', 'branch_id']);

        $this->assertNothingWritten();
    }

    // ------------------------------------------------------------------
    // AC-7 TIN
    // ------------------------------------------------------------------

    public function test_ac5_soft_deleted_branch_is_refused(): void
    {
        $this->branchB->delete();

        $this->store($this->admin, $this->payload('Returned to supplier', [
            $this->piece(5, $this->batchB, $this->productB),
        ], ['branch_id' => $this->branchB->id]))->assertSessionHasErrors('branch_id');

        $this->assertSame(0, StockOut::count());
        $this->assertSame(200, (int) $this->batchB->fresh()->quantity);
    }

    // ------------------------------------------------------------------
    // AC-6 recipient
    // ------------------------------------------------------------------

    public function test_ac6_delivered_to_is_required_for_a_delivery(): void
    {
        foreach ([null, '', '   '] as $blank) {
            $payload = $this->payload('Delivery to Customer', [$this->piece(3)], ['delivered_to' => $blank]);
            if ($blank === null) {
                unset($payload['delivered_to']);
            }

            $this->store($this->admin, $payload)->assertSessionHasErrors('delivered_to');
        }

        $this->assertNothingWritten();
    }

    public function test_ac6_return_to_supplier_needs_no_recipient(): void
    {
        $this->store($this->admin, $this->payload('Returned to supplier', [$this->piece(3)]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertNull(StockOut::firstOrFail()->delivered_to);
    }

    public function test_ac6_delivery_address_is_optional(): void
    {
        $this->store($this->admin, $this->payload('Delivery to Customer', [$this->piece(3)], ['delivered_to_address' => null]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');
    }

    // ------------------------------------------------------------------
    // AC-7 TIN
    // ------------------------------------------------------------------

    public function test_ac7_contract_valid_tins_are_accepted(): void
    {
        foreach (['123456789', '123-456-789', '123-456-789-000', '123-456-789-00000', '12345678900000', ' 123-456-789 '] as $tin) {
            $this->flushSession();
            $this->store($this->admin, $this->payload('Delivery to Customer', [$this->piece(1)], ['delivered_to_tin' => $tin]))
                ->assertSessionHasNoErrors()
                ->assertSessionHas('success');
        }

        $this->assertSame(6, StockOut::count());
        $this->assertSame('123-456-789', StockOut::query()->latest('stock_out_id')->first()->delivered_to_tin);
    }

    public function test_ac7_contract_invalid_tins_are_refused(): void
    {
        foreach (['12-345-678', '123 456 789', 'ABC-456-789', '123-456-789-0', '123-456-789-000000'] as $tin) {
            $this->store($this->admin, $this->payload('Delivery to Customer', [$this->piece(1)], ['delivered_to_tin' => $tin]))
                ->assertSessionHasErrors('delivered_to_tin');
        }

        $this->assertNothingWritten();
    }

    public function test_ac7_tin_is_optional(): void
    {
        $this->store($this->admin, $this->payload('Delivery to Customer', [$this->piece(3)], ['delivered_to_tin' => '']))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertNull(StockOut::firstOrFail()->delivered_to_tin);
    }

    public function test_ac7_valid_tin_is_stored(): void
    {
        $this->store($this->admin, $this->payload('Delivery to Customer', [$this->piece(3)], ['delivered_to_tin' => '123-456-789-00000']))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame('123-456-789-00000', StockOut::firstOrFail()->delivered_to_tin);
    }

    public function test_ac7_malformed_tin_is_refused(): void
    {
        foreach (['ABC-123', '12-34', str_repeat('9', 51)] as $tin) {
            $this->store($this->admin, $this->payload('Delivery to Customer', [$this->piece(3)], ['delivered_to_tin' => $tin]))
                ->assertSessionHasErrors('delivered_to_tin');
        }

        $this->assertNothingWritten();
    }

    // ------------------------------------------------------------------
    // AC-8 / AC-9 basket and quantity bounds
    // ------------------------------------------------------------------

    public function test_ac8_empty_basket_is_refused(): void
    {
        $this->store($this->admin, $this->payload('Delivery to Customer', []))
            ->assertSessionHasErrors('items');

        $payload = $this->payload('Delivery to Customer', []);
        unset($payload['items']);
        $this->store($this->admin, $payload)->assertSessionHasErrors('items');

        $this->assertNothingWritten();
    }

    public function test_ac9_quantity_bounds_are_line_errors(): void
    {
        foreach ([0, -1, self::MAX + 1, 1.5, 'abc', null] as $bad) {
            // Bad quantity on line 2 (index 1) behind a valid line 1.
            $response = $this->store($this->admin, $this->payload('Delivery to Customer', [
                $this->piece(1),
                $this->piece($bad),
            ]));

            $this->assertLineError($response, 1, 'quantity_deducted');
        }

        $this->assertNothingWritten();
    }

    public function test_ac9_unknown_unit_type_is_a_line_error(): void
    {
        foreach (['Pack', '', null] as $bad) {
            $line = $this->piece(1);
            $line['unit_type'] = $bad;

            $this->assertLineError(
                $this->store($this->admin, $this->payload('Delivery to Customer', [$this->piece(1), $line])),
                1,
                'unit_type'
            );
        }

        $this->assertNothingWritten();
    }

    public function test_ac9_lowercase_legacy_unit_types_are_accepted_and_stored_canonical(): void
    {
        $box = $this->box(2, 10);
        $box['unit_type'] = 'box';
        $piece = $this->piece(3);
        $piece['unit_type'] = 'piece';

        $this->store($this->admin, $this->payload('Returned to supplier', [$box, $piece]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $items = StockOutItem::orderBy('item_id')->get();
        $this->assertSame('Box', $items[0]->unit_type);
        $this->assertSame(20, (int) $items[0]->pieces_deducted);
        $this->assertSame('Piece', $items[1]->unit_type);
        $this->assertSame(77, (int) $this->batch->fresh()->quantity);
    }

    // ------------------------------------------------------------------
    // AC-10 / AC-11 availability
    // ------------------------------------------------------------------

    public function test_ac10_single_line_over_the_lot_is_a_line_error(): void
    {
        $response = $this->store($this->admin, $this->payload('Delivery to Customer', [
            $this->piece(1),
            $this->piece(1),
            $this->piece(101),
        ]));

        $this->assertLineError($response, 2, 'quantity_deducted');
        $this->assertNothingWritten();
    }

    public function test_ac10_return_to_supplier_over_the_lot_is_a_line_error_and_nothing_deducted(): void
    {
        $response = $this->store($this->admin, $this->payload('Returned to supplier', [$this->piece(101)]));

        $this->assertLineError($response, 0, 'quantity_deducted');
        $this->assertNothingWritten();
        $this->assertSame(0, InventoryMovementLog::where('movement_type', InventoryMovementLog::TYPE_STOCK_OUT)->count());
    }

    public function test_ac11_same_lot_across_lines_cannot_exceed_the_lot(): void
    {
        $response = $this->store($this->admin, $this->payload('Delivery to Customer', [
            $this->piece(60),
            $this->piece(60),
        ]));

        $this->assertLineError($response, 1, 'quantity_deducted');
        $this->assertNothingWritten();
    }

    public function test_ac11_cross_line_error_is_keyed_on_the_first_overflowing_line_only(): void
    {
        $response = $this->store($this->admin, $this->payload('Delivery to Customer', [
            $this->piece(40),
            $this->piece(40),
            $this->piece(40),
            $this->piece(40),
        ]));

        $this->assertLineError($response, 2, 'quantity_deducted');
        $this->assertStringContainsString('LOT-001', session('errors')->first('items.2.quantity_deducted'));
        $this->assertFalse(session('errors')->has('items.0.quantity_deducted'));
        $this->assertFalse(session('errors')->has('items.1.quantity_deducted'));
        $this->assertFalse(session('errors')->has('items.3.quantity_deducted'), 'Later lines of the same lot must not repeat the error');
        $this->assertNothingWritten();
    }

    public function test_ac11_lines_on_different_lots_are_checked_per_lot(): void
    {
        $lot2 = ProductQty::create([
            'product_id' => $this->product->id, 'quantity' => 30, 'status' => 'Active',
            'lot_number' => 'LOT-002', 'expiry' => now()->addYears(2)->toDateString(),
        ]);

        // 90 from LOT-001 (fits 100) and 30 from LOT-002 (fits 30): accepted.
        $this->store($this->admin, $this->payload('Returned to supplier', [
            $this->piece(90),
            $this->piece(30, $lot2),
        ]))->assertSessionHasNoErrors()->assertSessionHas('success');

        $this->assertSame(10, (int) $this->batch->fresh()->quantity);
        $this->assertSame(0, (int) $lot2->fresh()->quantity);
    }

    public function test_ac11_same_lot_mixed_box_and_piece_lines_are_summed_in_pieces(): void
    {
        // 5 boxes x 10 = 50 pieces + 60 pieces = 110 > 100.
        $response = $this->store($this->admin, $this->payload('Returned to supplier', [
            $this->box(5, 10),
            $this->piece(60),
        ]));

        $this->assertLineError($response, 1, 'quantity_deducted');
        $this->assertNothingWritten();
    }

    public function test_ac11_same_lot_lines_summing_to_exactly_the_lot_are_accepted(): void
    {
        $this->store($this->admin, $this->payload('Returned to supplier', [
            $this->box(5, 10),
            $this->piece(50),
        ]))->assertSessionHasNoErrors()->assertSessionHas('success');

        $this->assertSame(0, (int) $this->batch->fresh()->quantity);
    }

    // ------------------------------------------------------------------
    // AC-12 pieces per box
    // ------------------------------------------------------------------

    public function test_ac12_box_without_pieces_per_box_is_a_line_error(): void
    {
        $response = $this->store($this->admin, $this->payload('Delivery to Customer', [
            $this->piece(1),
            $this->box(2, null),
        ]));
        $this->assertLineError($response, 1, 'pieces_per_box');

        $response = $this->store($this->admin, $this->payload('Delivery to Customer', [
            $this->box(2, 0),
        ]));
        $this->assertLineError($response, 0, 'pieces_per_box');

        $this->assertNothingWritten();
    }

    public function test_ac12_pieces_per_box_is_ignored_on_piece_lines(): void
    {
        $zero = $this->piece(3);
        $zero['pieces_per_box'] = 0;
        $empty = $this->piece(4);
        $empty['pieces_per_box'] = '';
        $number = $this->piece(5);
        $number['pieces_per_box'] = 12;

        $this->store($this->admin, $this->payload('Returned to supplier', [$zero, $empty, $number]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $items = StockOutItem::orderBy('item_id')->get();
        $this->assertSame([3, 4, 5], $items->pluck('pieces_deducted')->map(fn ($v) => (int) $v)->all());
        $this->assertSame([null, null, null], $items->pluck('pieces_per_box')->all());
        $this->assertSame(88, (int) $this->batch->fresh()->quantity);
    }

    public function test_ac12_typed_pieces_per_box_is_used_not_pack_size(): void
    {
        // pack_size is 10, but this shipment's boxes hold 12.
        $this->store($this->admin, $this->payload('Returned to supplier', [$this->box(3, 12)]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame(36, (int) StockOutItem::firstOrFail()->pieces_deducted);
        $this->assertSame(64, (int) $this->batch->fresh()->quantity);
    }

    // ------------------------------------------------------------------
    // AC-13 expired / deleted lots
    // ------------------------------------------------------------------

    public function test_ac13_expired_and_deleted_lots_are_refused(): void
    {
        $expiredStatus = ProductQty::create([
            'product_id' => $this->product->id, 'quantity' => 50, 'status' => 'Expired',
            'lot_number' => 'LOT-EXP', 'expiry' => now()->subDay()->toDateString(),
        ]);
        $pastButActive = ProductQty::create([
            'product_id' => $this->product->id, 'quantity' => 50, 'status' => 'Active',
            'lot_number' => 'LOT-PAST', 'expiry' => now()->subDays(3)->toDateString(),
        ]);
        $deleted = ProductQty::create([
            'product_id' => $this->product->id, 'quantity' => 50, 'status' => 'Deleted',
            'lot_number' => 'LOT-DEL', 'expiry' => now()->addYear()->toDateString(),
        ]);

        foreach ([$expiredStatus, $pastButActive, $deleted] as $lot) {
            foreach (['Delivery to Customer', 'Returned to supplier'] as $subtype) {
                $response = $this->store($this->admin, $this->payload($subtype, [
                    $this->piece(1),
                    $this->piece(5, $lot),
                ]));

                $this->assertLineError($response, 1, 'products_qty_id');
            }

            $this->assertSame(50, (int) $lot->fresh()->quantity);
        }

        $this->assertNothingWritten();
    }

    // ------------------------------------------------------------------
    // AC-14 branch isolation of lines
    // ------------------------------------------------------------------

    public function test_ac14_medicine_from_another_branch_is_a_line_error(): void
    {
        $response = $this->store($this->admin, $this->payload('Returned to supplier', [
            $this->piece(1),
            $this->piece(5, $this->batchB, $this->productB),
        ]));

        $this->assertLineError($response, 1, 'pd_id');
        $this->assertNothingWritten();
        $this->assertSame(200, (int) $this->batchB->fresh()->quantity);
    }

    public function test_ac14_lot_of_another_medicine_is_a_line_error(): void
    {
        // pd_id is a branch-A medicine, but the lot belongs to branch B's medicine.
        $response = $this->store($this->admin, $this->payload('Returned to supplier', [
            $this->piece(5, $this->batchB, $this->product),
        ]));

        $this->assertLineError($response, 0, 'products_qty_id');
        $this->assertNothingWritten();
        $this->assertSame(200, (int) $this->batchB->fresh()->quantity);
    }

    public function test_ac14_admin_choosing_branch_b_with_a_branch_a_basket_is_refused(): void
    {
        $response = $this->store($this->admin, $this->payload('Returned to supplier', [
            $this->piece(5),
        ], ['branch_id' => $this->branchB->id]));

        $this->assertLineError($response, 0, 'pd_id');
        $this->assertNothingWritten();
    }

    // ------------------------------------------------------------------
    // AC-15 all errors together
    // ------------------------------------------------------------------

    public function test_ac15_header_and_line_errors_come_back_together(): void
    {
        $expired = ProductQty::create([
            'product_id' => $this->product->id, 'quantity' => 50, 'status' => 'Expired',
            'lot_number' => 'LOT-EXP', 'expiry' => now()->subDay()->toDateString(),
        ]);

        $response = $this->store($this->admin, $this->payload('Delivery to Customer', [
            $this->piece(0),
            $this->piece(5, $expired),
            $this->box(1, null),
            $this->piece(150),
        ], ['issued_by' => '', 'delivered_to' => '']));

        $response->assertSessionHasErrors(['issued_by', 'delivered_to']);
        $this->assertLineError($response, 0, 'quantity_deducted');
        $this->assertLineError($response, 1, 'products_qty_id');
        $this->assertLineError($response, 2, 'pieces_per_box');
        $this->assertLineError($response, 3, 'quantity_deducted');
        $this->assertNothingWritten();
    }

    // ------------------------------------------------------------------
    // AC-16 / AC-17 idempotency
    // ------------------------------------------------------------------

    public function test_ac16_validation_rejection_does_not_burn_the_key(): void
    {
        $payload = $this->payload('Returned to supplier', [$this->piece(1), $this->piece(0)]);

        $this->assertLineError($this->store($this->admin, $payload), 1, 'quantity_deducted');
        $this->assertFalse($this->idempotencyKeyClaimed($payload['idempotency_key']));

        $payload['items'][1]['quantity_deducted'] = 4;
        $this->store($this->admin, $payload)->assertSessionHasNoErrors()->assertSessionHas('success');

        $this->assertSame(1, StockOut::count());
        $this->assertSame(95, (int) $this->batch->fresh()->quantity);
    }

    public function test_ac16_availability_rejection_does_not_burn_the_key(): void
    {
        $payload = $this->payload('Returned to supplier', [$this->piece(60), $this->piece(60)]);

        $response = $this->store($this->admin, $payload);
        $this->assertExplicitOutcome($response);
        $this->assertSame(0, StockOut::count());
        $this->assertFalse($this->idempotencyKeyClaimed($payload['idempotency_key']));

        $payload['items'][1]['quantity_deducted'] = 40;
        $this->store($this->admin, $payload)->assertSessionHasNoErrors()->assertSessionHas('success');

        $this->assertSame(1, StockOut::count());
        $this->assertSame(0, (int) $this->batch->fresh()->quantity);
    }

    public function test_ac16_expired_lot_rejection_does_not_burn_the_key(): void
    {
        $this->batch->update(['expiry' => now()->subDay()->toDateString()]);
        $fresh = ProductQty::create([
            'product_id' => $this->product->id, 'quantity' => 30, 'status' => 'Active',
            'lot_number' => 'LOT-NEW', 'expiry' => now()->addYear()->toDateString(),
        ]);

        $payload = $this->payload('Delivery to Customer', [$this->piece(5)]);
        $this->assertLineError($this->store($this->admin, $payload), 0, 'products_qty_id');

        $payload['items'][0]['products_qty_id'] = $fresh->id;
        $this->store($this->admin, $payload)->assertSessionHasNoErrors()->assertSessionHas('success');

        $this->assertSame(1, StockOut::count());
    }

    public function test_ac17_duplicate_replay_does_not_double_post_and_reports_success(): void
    {
        $payload = $this->payload('Returned to supplier', [$this->box(1, 10), $this->piece(5)]);

        $this->store($this->admin, $payload)->assertSessionHasNoErrors()->assertSessionHas('success');

        // Fresh session state for the replay.
        $this->flushSession();
        $replay = $this->store($this->admin, $payload);

        $replay->assertSessionHasNoErrors()->assertSessionHas('success');
        $this->assertNull(session('error'));
        $this->assertSame(1, StockOut::count());
        $this->assertSame(2, StockOutItem::count());
        $this->assertSame(85, (int) $this->batch->fresh()->quantity);
        $this->assertSame(2, InventoryMovementLog::where('movement_type', InventoryMovementLog::TYPE_STOCK_OUT)->count());
    }

    /**
     * AC-17: a Returned-to-supplier deducts at once, so on a replay the lot no
     * longer holds the original quantity. The replay (lost response, double
     * click after a slow save) must still be recognised as "already saved",
     * not rejected as insufficient stock - that would report a saved
     * stock-out as a failure.
     */
    public function test_ac17_replay_after_the_lot_was_drawn_down_still_reports_already_saved(): void
    {
        $payload = $this->payload('Returned to supplier', [$this->piece(60)]);

        $this->store($this->admin, $payload)->assertSessionHasNoErrors()->assertSessionHas('success');
        $this->assertSame(40, (int) $this->batch->fresh()->quantity);

        $this->flushSession();
        $replay = $this->store($this->admin, $payload);

        $replay->assertSessionHasNoErrors();
        $replay->assertSessionHas('success');
        $this->assertSame(1, StockOut::count());
        $this->assertSame(40, (int) $this->batch->fresh()->quantity);
    }

    public function test_ac17_replay_of_a_box_return_that_emptied_the_lot_still_reports_already_saved(): void
    {
        $payload = $this->payload('Returned to supplier', [$this->box(10, 10)]);

        $this->store($this->admin, $payload)->assertSessionHasNoErrors()->assertSessionHas('success');
        $this->assertSame(0, (int) $this->batch->fresh()->quantity);

        $this->flushSession();
        $this->store($this->admin, $payload)
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame(1, StockOut::count());
        $this->assertSame(0, (int) $this->batch->fresh()->quantity);
    }

    // ------------------------------------------------------------------
    // AC-18 no silent outcome
    // ------------------------------------------------------------------

    public function test_ac18_every_store_outcome_is_explicit(): void
    {
        $cases = [
            $this->payload('Delivery to Customer', [$this->piece(5)]),
            $this->payload('Returned to supplier', [$this->piece(5)]),
            $this->payload('Delivery to Customer', [$this->piece(500)]),
            $this->payload('Returned to supplier', [$this->piece(60), $this->piece(60)]),
            $this->payload('Delivery to Customer', [$this->box(2, null)]),
            $this->payload('Delivery to Customer', [$this->piece(5, $this->batchB, $this->productB)]),
        ];

        foreach ($cases as $i => $payload) {
            $this->flushSession();
            $response = $this->store($this->admin, $payload);
            $response->assertRedirect();
            $this->assertExplicitOutcome($response);
        }
    }

    // ------------------------------------------------------------------
    // AC-19 .. AC-22 update
    // ------------------------------------------------------------------

    public function test_ac19_update_replaces_items_with_piece_and_box_lines(): void
    {
        $stockOut = $this->pendingDelivery();

        $this->update($this->admin, $stockOut, $this->updatePayload([
            $this->piece(7),
            $this->box(3, 10),
        ], ['delivered_to_tin' => '123-456-789-00000']))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $items = StockOutItem::where('stock_out_id', $stockOut->stock_out_id)->orderBy('item_id')->get();
        $this->assertCount(2, $items);
        $this->assertSame(7, (int) $items[0]->pieces_deducted);
        $this->assertEquals(5.00, (float) $items[0]->unit_price);
        $this->assertSame(30, (int) $items[1]->pieces_deducted);
        $this->assertEquals(45.00, (float) $items[1]->unit_price);
        $this->assertSame('123-456-789-00000', $stockOut->fresh()->delivered_to_tin);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_ac20_update_line_rules_match_store(): void
    {
        $stockOut = $this->pendingDelivery();
        $expired = ProductQty::create([
            'product_id' => $this->product->id, 'quantity' => 50, 'status' => 'Active',
            'lot_number' => 'LOT-PAST', 'expiry' => now()->subDay()->toDateString(),
        ]);

        $cases = [
            ['items' => [$this->piece(1), $this->piece(0)], 'line' => 1, 'field' => 'quantity_deducted'],
            ['items' => [$this->piece(self::MAX + 1)], 'line' => 0, 'field' => 'quantity_deducted'],
            ['items' => [$this->piece(1), $this->piece(101)], 'line' => 1, 'field' => 'quantity_deducted'],
            ['items' => [$this->piece(70), $this->piece(70)], 'line' => 1, 'field' => 'quantity_deducted'],
            ['items' => [$this->box(11, 10)], 'line' => 0, 'field' => 'quantity_deducted'],
            ['items' => [$this->piece(1), $this->box(2, null)], 'line' => 1, 'field' => 'pieces_per_box'],
            ['items' => [$this->piece(1), $this->piece(2, $expired)], 'line' => 1, 'field' => 'products_qty_id'],
            ['items' => [$this->piece(2, $this->batchB, $this->productB)], 'line' => 0, 'field' => 'pd_id'],
        ];

        foreach ($cases as $case) {
            $this->flushSession();
            $response = $this->update($this->admin, $stockOut, $this->updatePayload($case['items']));
            $this->assertLineError($response, $case['line'], $case['field']);
        }

        $items = StockOutItem::where('stock_out_id', $stockOut->stock_out_id)->get();
        $this->assertCount(1, $items);
        $this->assertSame(5, (int) $items[0]->pieces_deducted);
    }

    public function test_ac21_update_header_rules(): void
    {
        $stockOut = $this->pendingDelivery();

        $this->update($this->admin, $stockOut, $this->updatePayload([$this->piece(5)], ['issued_by' => '']))
            ->assertSessionHasErrors('issued_by');

        $this->flushSession();
        $this->update($this->admin, $stockOut, $this->updatePayload([$this->piece(5)], ['delivered_to_tin' => 'ABC-123']))
            ->assertSessionHasErrors('delivered_to_tin');

        $this->flushSession();
        $this->update($this->admin, $stockOut, $this->updatePayload([$this->piece(5)], ['delivered_to' => '']))
            ->assertSessionHasErrors('delivered_to');

        $this->assertSame('Issuer', $stockOut->fresh()->issued_by);
        $this->assertSame('ABC Clinic', $stockOut->fresh()->delivered_to);
    }

    public function test_ac22_edit_returns_canonical_unit_type_for_legacy_rows(): void
    {
        $stockOut = StockOut::create([
            'transaction_subtype' => 'Delivery to Customer',
            'branch_id' => $this->branchA->id,
            'issued_by' => 'Legacy',
            'delivered_to' => 'Old Clinic',
        ]);

        foreach ([['box', 2, 20, 10], ['piece', 3, 3, null]] as [$unit, $qty, $pieces, $ppb]) {
            StockOutItem::create([
                'stock_out_id' => $stockOut->stock_out_id,
                'pd_id' => $this->product->id,
                'products_qty_id' => $this->batch->id,
                'lot_number' => 'LOT-001',
                'quantity_deducted' => $qty,
                'pieces_deducted' => $pieces,
                'expiry' => $this->batch->expiry,
                'unit_type' => $unit,
                'pieces_per_box' => $ppb,
            ]);
        }

        $this->actingAsWithSession($this->staff)
            ->getJson(route('stock-out.edit', $stockOut))
            ->assertOk()
            ->assertJsonPath('items.0.unit_type', 'Box')
            ->assertJsonPath('items.1.unit_type', 'Piece');
    }

    // ------------------------------------------------------------------
    // AC-23 basket source
    // ------------------------------------------------------------------

    public function test_ac23_products_endpoint_flags_expired_lots_and_hides_dead_ones(): void
    {
        $this->product->update(['vat_status' => 'VAT']);

        $pastButActive = ProductQty::create([
            'product_id' => $this->product->id, 'quantity' => 50, 'status' => 'Active',
            'lot_number' => 'LOT-PAST', 'expiry' => now()->subDays(3)->toDateString(),
        ]);
        ProductQty::create([
            'product_id' => $this->product->id, 'quantity' => 50, 'status' => 'Expired',
            'lot_number' => 'LOT-EXP', 'expiry' => now()->subDays(10)->toDateString(),
        ]);
        ProductQty::create([
            'product_id' => $this->product->id, 'quantity' => 50, 'status' => 'Deleted',
            'lot_number' => 'LOT-DEL', 'expiry' => now()->addYear()->toDateString(),
        ]);

        $json = $this->actingAsWithSession($this->staff)
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchA->id]))
            ->assertOk()
            ->json();

        $products = collect($json['products']);
        $this->assertSame([$this->product->id], $products->pluck('id')->all(), 'Only branch A medicines');

        $product = $products->first();
        $lots = collect($product['batches'])->keyBy('lot_number');
        $this->assertSame(['LOT-PAST', 'LOT-001'], $lots->keys()->all(), 'Expired/Deleted status lots hidden, oldest expiry first');
        $this->assertTrue($lots['LOT-PAST']['is_expired']);
        $this->assertFalse($lots['LOT-001']['is_expired']);
        $this->assertSame(100, (int) $lots['LOT-001']['quantity']);
        $this->assertSame($pastButActive->id, $lots['LOT-PAST']['id']);

        $this->assertEqualsWithDelta(5.60, (float) $product['effective_retail_price'], 0.001);
        $this->assertEqualsWithDelta(50.40, (float) $product['effective_wholesale_price'], 0.001);
        $this->assertSame('5.00', (string) $product['retail_price']);

        $this->actingAsWithSession($this->staff)
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchB->id]))
            ->assertForbidden();
    }

    public function test_ac23_non_vat_effective_price_equals_base(): void
    {
        $this->product->update(['vat_status' => 'Non-VAT']);

        $product = collect($this->actingAsWithSession($this->admin)
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchA->id]))
            ->assertOk()
            ->json('products'))->first();

        $this->assertEqualsWithDelta(5.00, (float) $product['effective_retail_price'], 0.001);
        $this->assertEqualsWithDelta(45.00, (float) $product['effective_wholesale_price'], 0.001);
    }

    public function test_ac22_staff_of_another_branch_cannot_edit_or_update(): void
    {
        $stockOut = $this->pendingDelivery();

        $staffB = User::create([
            'name' => 'Staff B', 'email' => 'staffb@westpoint.test', 'password' => bcrypt('password'),
            'role_id' => 1, 'branch_id' => $this->branchB->id, 'email_verified_at' => now(),
        ]);

        $this->actingAsWithSession($staffB)->getJson(route('stock-out.edit', $stockOut))->assertForbidden();
        $this->update($staffB, $stockOut, $this->updatePayload([$this->piece(9)]))->assertForbidden();

        $this->assertSame(5, (int) StockOutItem::where('stock_out_id', $stockOut->stock_out_id)->sum('pieces_deducted'));
    }

    public function test_ac22_non_editable_stock_outs_are_refused_with_a_reason(): void
    {
        $this->store($this->admin, $this->payload('Returned to supplier', [$this->piece(5)]))->assertSessionHas('success');
        $returned = StockOut::firstOrFail();

        $this->flushSession();
        $response = $this->update($this->admin, $returned, $this->updatePayload([$this->piece(9)]));
        $this->assertTrue(filled(session('error')), 'Editing a Returned-to-supplier stock-out must report a reason');
        $this->assertSame(5, (int) StockOutItem::where('stock_out_id', $returned->stock_out_id)->sum('pieces_deducted'));

        $delivery = $this->pendingDelivery();
        $this->flushSession();
        $this->actingAsWithSession($this->admin)
            ->from(route('medicine-inventory.index'))
            ->post(route('stock-out.confirm-delivery', $delivery))
            ->assertSessionHas('success');

        $this->flushSession();
        $this->update($this->admin, $delivery, $this->updatePayload([$this->piece(9)]));
        $this->assertTrue(filled(session('error')), 'Editing a confirmed delivery must report a reason');
        $this->assertSame(5, (int) StockOutItem::where('stock_out_id', $delivery->stock_out_id)->sum('pieces_deducted'));
    }

    public function test_ac22_update_cannot_move_the_stock_out_to_another_branch(): void
    {
        $stockOut = $this->pendingDelivery();

        $this->update($this->admin, $stockOut, $this->updatePayload([$this->piece(5)], ['branch_id' => $this->branchB->id]));

        $this->assertSame($this->branchA->id, (int) $stockOut->fresh()->branch_id);
    }
}
