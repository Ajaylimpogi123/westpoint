<?php

namespace Tests\Feature;

use App\Models\InventoryMovementLog;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\StockOut;
use App\Models\StockOutItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * Contract: .claude/handoff/stock-out-validation-basket.md
 */
class StockOutValidationTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    private function payload(string $subtype, array $items, array $extra = []): array
    {
        return array_merge([
            'transaction_subtype' => $subtype,
            'branch_id' => $this->branchA->id,
            'issued_by' => 'Issuer',
            'delivered_to' => 'ABC Clinic',
            'idempotency_key' => 'so-'.uniqid(),
            'items' => $items,
        ], $extra);
    }

    private function piece(int $quantity, array $extra = []): array
    {
        return array_merge([
            'pd_id' => $this->product->id,
            'products_qty_id' => $this->batch->id,
            'quantity_deducted' => $quantity,
            'unit_type' => 'Piece',
        ], $extra);
    }

    private function box(int $boxes, ?int $piecesPerBox = 10, array $extra = []): array
    {
        return array_merge([
            'pd_id' => $this->product->id,
            'products_qty_id' => $this->batch->id,
            'quantity_deducted' => $boxes,
            'unit_type' => 'Box',
            'pieces_per_box' => $piecesPerBox,
        ], $extra);
    }

    private function storeAsAdmin(array $payload)
    {
        return $this->actingAsWithSession($this->admin)->post(route('stock-out.store'), $payload);
    }

    private function pendingDelivery(): StockOut
    {
        $this->storeAsAdmin($this->payload('Delivery to Customer', [$this->piece(5)]))->assertSessionHas('success');

        return StockOut::firstOrFail();
    }

    // ---- Header fields ------------------------------------------------------

    public function test_required_header_fields_have_readable_messages(): void
    {
        $this->storeAsAdmin(['items' => []])
            ->assertSessionHasErrors([
                'transaction_subtype' => 'Choose a transaction type: Delivery to Customer or Returned to supplier.',
                'branch_id' => 'Choose the source branch.',
                'issued_by' => 'Enter who issued this stock-out.',
                'items' => 'Add at least one medicine to the basket.',
            ]);

        $this->storeAsAdmin($this->payload('Dispensed to patient', [$this->piece(1)]))
            ->assertSessionHasErrors(['transaction_subtype' => 'Choose a transaction type: Delivery to Customer or Returned to supplier.']);

        $this->assertSame(0, StockOut::count());
    }

    public function test_delivery_requires_delivered_to_but_return_to_supplier_does_not(): void
    {
        $this->storeAsAdmin($this->payload('Delivery to Customer', [$this->piece(5)], ['delivered_to' => '  ']))
            ->assertSessionHasErrors(['delivered_to' => 'Enter who the delivery is for. It is printed on the Delivery Receipt.']);

        $this->assertSame(0, StockOut::count());

        $this->storeAsAdmin($this->payload('Returned to supplier', [$this->piece(5)], ['delivered_to' => null]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', 'Stock-out transaction recorded successfully.');

        // Address is optional for deliveries.
        $this->storeAsAdmin($this->payload('Delivery to Customer', [$this->piece(5)], ['delivered_to_address' => null]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame(2, StockOut::count());
    }

    public function test_staff_cannot_pick_another_source_branch(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post(route('stock-out.store'), $this->payload('Returned to supplier', [$this->piece(5)], [
                'branch_id' => $this->branchB->id,
            ]))
            ->assertSessionHasErrors(['branch_id' => 'You can only record transactions for your assigned branch.']);

        $this->assertSame(0, StockOut::count());
    }

    public function test_tin_accepts_philippine_formats(): void
    {
        foreach (['123456789', '123-456-789', '123-456-789-000', '123-456-789-00000', '12345678900000', ''] as $tin) {
            $this->storeAsAdmin($this->payload('Delivery to Customer', [$this->piece(1)], ['delivered_to_tin' => $tin]))
                ->assertSessionHasNoErrors();
        }

        $this->assertSame(6, StockOut::count());
        $this->assertSame('123-456-789-00000', StockOut::where('delivered_to_tin', 'like', '%-00000')->value('delivered_to_tin'));
    }

    public function test_tin_rejects_other_formats(): void
    {
        $message = 'Enter the TIN as 9 digits with an optional 3-5 digit branch code, e.g. 123-456-789 or 123-456-789-00000.';

        foreach (['12-345-678', '123 456 789', 'ABC-456-789', '123-456-789-0', '123-456-789-000000', '12345678'] as $tin) {
            $this->storeAsAdmin($this->payload('Delivery to Customer', [$this->piece(1)], ['delivered_to_tin' => $tin]))
                ->assertSessionHasErrors(['delivered_to_tin' => $message]);
        }

        $this->assertSame(0, StockOut::count());
    }

    // ---- Line fields ----------------------------------------------------------

    public function test_line_errors_name_the_line_number(): void
    {
        $this->storeAsAdmin($this->payload('Returned to supplier', [
            $this->piece(1),
            $this->piece(0),
            $this->piece(1, ['unit_type' => 'Carton']),
            ['pd_id' => null, 'products_qty_id' => null, 'quantity_deducted' => 2.5, 'unit_type' => 'Piece'],
            $this->piece(1_000_001),
        ]))->assertSessionHasErrors([
            'items.1.quantity_deducted' => 'Line 2: quantity must be at least 1.',
            'items.2.unit_type' => 'Line 3: choose Piece or Box.',
            'items.3.pd_id' => 'Line 4: choose a medicine.',
            'items.3.products_qty_id' => 'Line 4: choose a lot.',
            'items.3.quantity_deducted' => 'Line 4: quantity must be a whole number.',
            'items.4.quantity_deducted' => 'Line 5: quantity may not be more than 1,000,000.',
        ]);

        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_box_line_without_pieces_per_box_is_a_line_error_and_does_not_burn_the_key(): void
    {
        $payload = $this->payload('Returned to supplier', [$this->piece(1), $this->box(3, null)], ['idempotency_key' => 'box-key']);

        $this->storeAsAdmin($payload)
            ->assertSessionHasErrors(['items.1.pieces_per_box' => 'Line 2: enter how many pieces are in one box.'])
            ->assertSessionMissing('error');

        $this->storeAsAdmin($this->payload('Returned to supplier', [$this->box(3, 0)]))
            ->assertSessionHasErrors(['items.0.pieces_per_box' => 'Line 1: pieces per box must be a whole number from 1 to 1,000,000.']);

        $this->assertSame(0, StockOut::count());
        $this->assertDatabaseMissing('tbl_idempotency_keys', ['idempotency_key' => 'box-key']);

        // Same key, fixed basket: 1 piece + 3 boxes x 10 = 31 pieces.
        $payload['items'][1]['pieces_per_box'] = 10;

        $this->storeAsAdmin($payload)->assertSessionHasNoErrors()->assertSessionHas('success');

        $this->assertSame(69, (int) $this->batch->fresh()->quantity);

        $box = StockOutItem::where('unit_type', 'Box')->firstOrFail();
        $this->assertSame(3, (int) $box->quantity_deducted);
        $this->assertSame(30, (int) $box->pieces_deducted);
        $this->assertSame(10, (int) $box->pieces_per_box);
        $this->assertSame(-30, (int) InventoryMovementLog::where('quantity', -30)->value('quantity'));
        $this->assertSame($this->branchA->id, (int) InventoryMovementLog::where('quantity', -30)->value('branch_id'));
    }

    public function test_pieces_per_box_is_ignored_on_piece_lines_and_lowercase_units_are_accepted(): void
    {
        $this->storeAsAdmin($this->payload('Delivery to Customer', [
            $this->piece(4, ['pieces_per_box' => 0]),
            $this->box(2, 12, ['unit_type' => 'box']),
        ]))->assertSessionHasNoErrors()->assertSessionHas('success');

        $items = StockOutItem::orderBy('item_id')->get();
        $this->assertSame('Piece', $items[0]->unit_type);
        $this->assertNull($items[0]->pieces_per_box);
        $this->assertSame(4, (int) $items[0]->pieces_deducted);
        $this->assertSame('Box', $items[1]->unit_type);
        $this->assertSame(24, (int) $items[1]->pieces_deducted);

        // Delivery: nothing deducted until confirmation.
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    // ---- Lot sufficiency ----------------------------------------------------------

    public function test_single_line_over_the_lot_is_a_line_error(): void
    {
        $this->storeAsAdmin($this->payload('Delivery to Customer', [$this->piece(150)]))
            ->assertSessionHasErrors([
                'items.0.quantity_deducted' => 'Line 1: 150 pieces of Paracetamol exceed the 100 pieces available in lot LOT-001.',
            ]);

        // Box path: 11 boxes x 10 = 110 pieces.
        $this->storeAsAdmin($this->payload('Returned to supplier', [$this->box(11, 10)]))
            ->assertSessionHasErrors([
                'items.0.quantity_deducted' => 'Line 1: 110 pieces of Paracetamol exceed the 100 pieces available in lot LOT-001.',
            ]);

        $this->assertSame(0, StockOut::count());
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_lines_of_the_same_lot_are_totalled_including_box_lines(): void
    {
        $other = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 500,
            'status' => 'Active',
            'lot_number' => 'LOT-002',
            'expiry' => now()->addYears(2)->toDateString(),
        ]);

        // LOT-001: 40 + 5x10 + 20 = 110 > 100; first exceeded at line 4.
        $this->storeAsAdmin($this->payload('Returned to supplier', [
            $this->piece(40),
            $this->box(5, 10),
            $this->piece(200, ['products_qty_id' => $other->id]),
            $this->piece(20),
            $this->piece(5),
        ], ['idempotency_key' => 'sum-key']))
            ->assertSessionHasErrors([
                'items.3.quantity_deducted' => 'Line 4: lines 1, 2 and 4 together take 110 pieces of Paracetamol from lot LOT-001, but only 100 pieces are available.',
            ])
            ->assertSessionDoesntHaveErrors(['items.0.quantity_deducted', 'items.1.quantity_deducted', 'items.2.quantity_deducted', 'items.4.quantity_deducted']);

        $this->assertSame(0, StockOut::count());
        $this->assertSame(500, (int) $other->fresh()->quantity);
        $this->assertDatabaseMissing('tbl_idempotency_keys', ['idempotency_key' => 'sum-key']);
    }

    public function test_all_line_problems_come_back_in_one_response(): void
    {
        $expired = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 50,
            'status' => 'Active',
            'lot_number' => 'LOT-OLD',
            'expiry' => now()->subDay()->toDateString(),
        ]);

        $otherBranchProduct = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Amoxicillin',
            'pack_size' => 10,
            'retail_price' => 1,
            'wholesale_price' => 9,
            'status' => 'Active',
        ]);
        $otherBranchLot = ProductQty::create([
            'product_id' => $otherBranchProduct->id,
            'quantity' => 50,
            'status' => 'Active',
            'lot_number' => 'LOT-B',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $this->storeAsAdmin($this->payload('Delivery to Customer', [
            $this->piece(0),
            $this->piece(5, ['products_qty_id' => $expired->id]),
            $this->piece(5, ['pd_id' => $otherBranchProduct->id, 'products_qty_id' => $otherBranchLot->id]),
            $this->piece(101),
        ], ['delivered_to' => '']))->assertSessionHasErrors([
            'delivered_to',
            'items.0.quantity_deducted' => 'Line 1: quantity must be at least 1.',
            'items.1.products_qty_id' => 'Line 2: lot LOT-OLD of Paracetamol expired on '.now()->subDay()->format('d M Y').' and cannot be dispensed.',
            'items.2.pd_id' => 'Line 3: Amoxicillin is not available in Main Branch. Remove it from the list.',
            'items.3.quantity_deducted' => 'Line 4: 101 pieces of Paracetamol exceed the 100 pieces available in lot LOT-001.',
        ]);
    }

    public function test_replay_after_the_lot_was_drawn_down_is_reported_as_already_saved(): void
    {
        // Piece: 60 of 100, replay would no longer fit (40 left).
        $piecePayload = $this->payload('Returned to supplier', [$this->piece(60)], ['idempotency_key' => 'replay-piece']);
        $this->storeAsAdmin($piecePayload)->assertSessionHas('success', 'Stock-out transaction recorded successfully.');

        $this->storeAsAdmin($piecePayload)
            ->assertRedirect(route('medicine-inventory.index'))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', 'This stock-out was already saved.');

        // Box: 4 x 10 empties the remaining 40.
        $boxPayload = $this->payload('Returned to supplier', [$this->box(4, 10)], ['idempotency_key' => 'replay-box']);
        $this->storeAsAdmin($boxPayload)->assertSessionHas('success', 'Stock-out transaction recorded successfully.');

        $this->storeAsAdmin($boxPayload)
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', 'This stock-out was already saved.');

        $this->assertSame(2, StockOut::count());
        $this->assertSame(0, (int) $this->batch->fresh()->quantity);
        $this->assertSame(2, InventoryMovementLog::count());
    }

    // ---- Update (edit modal) ------------------------------------------------------

    public function test_update_requires_delivered_to_and_checks_lines(): void
    {
        $stockOut = $this->pendingDelivery();

        $this->actingAsWithSession($this->admin)
            ->put(route('stock-out.update', $stockOut), [
                'issued_by' => 'Issuer',
                'delivered_to' => '',
                'delivered_to_tin' => 'not-a-tin',
                'items' => [$this->box(2, null), $this->piece(101)],
            ])
            ->assertSessionHasErrors([
                'delivered_to' => 'Enter who the delivery is for. It is printed on the Delivery Receipt.',
                'delivered_to_tin',
                'items.0.pieces_per_box' => 'Line 1: enter how many pieces are in one box.',
                'items.1.quantity_deducted' => 'Line 2: 101 pieces of Paracetamol exceed the 100 pieces available in lot LOT-001.',
            ]);

        $this->assertSame(5, (int) $stockOut->items()->sum('pieces_deducted'));

        $this->actingAsWithSession($this->admin)
            ->put(route('stock-out.update', $stockOut), [
                'issued_by' => 'Issuer',
                'delivered_to' => 'XYZ Clinic',
                'items' => [$this->box(2, 12), $this->piece(76)],
            ])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', 'Stock-out transaction updated successfully.');

        $this->assertSame(100, (int) $stockOut->items()->sum('pieces_deducted'));
        $this->assertSame('XYZ Clinic', $stockOut->fresh()->delivered_to);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_edit_returns_canonical_unit_type_for_legacy_rows(): void
    {
        $stockOut = StockOut::create([
            'transaction_subtype' => 'Delivery to Customer',
            'branch_id' => $this->branchA->id,
            'issued_by' => 'Legacy',
        ]);

        StockOutItem::create([
            'stock_out_id' => $stockOut->stock_out_id,
            'pd_id' => $this->product->id,
            'products_qty_id' => $this->batch->id,
            'lot_number' => 'LOT-001',
            'quantity_deducted' => 2,
            'pieces_deducted' => 20,
            'unit_type' => 'box',
        ]);

        $this->actingAsWithSession($this->admin)
            ->getJson(route('stock-out.edit', $stockOut))
            ->assertOk()
            ->assertJsonPath('items.0.unit_type', 'Box')
            ->assertJsonPath('items.0.pieces_per_box', null);
    }

    public function test_confirmed_delivery_cannot_be_updated(): void
    {
        $stockOut = $this->pendingDelivery();
        $stockOut->update(['delivery_confirmed' => true]);

        $this->actingAsWithSession($this->admin)
            ->put(route('stock-out.update', $stockOut), [
                'issued_by' => 'Issuer',
                'delivered_to' => 'ABC Clinic',
                'items' => [$this->piece(1)],
            ])
            ->assertSessionHas('error', 'This stock-out can no longer be edited.');
    }

    // ---- Basket source --------------------------------------------------------

    public function test_branch_products_include_basket_fields(): void
    {
        $this->product->update(['vat_status' => 'VAT']);

        ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 30,
            'status' => 'Active',
            'lot_number' => 'LOT-LAPSED',
            'shelf_number' => 'A-3',
            'expiry' => now()->subDay()->toDateString(),
        ]);
        ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 30,
            'status' => 'Expired',
            'lot_number' => 'LOT-EXPIRED',
            'expiry' => now()->subMonth()->toDateString(),
        ]);

        $response = $this->actingAsWithSession($this->staff)
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchA->id]))
            ->assertOk()
            ->assertJsonCount(1, 'products')
            ->assertJsonPath('products.0.id', $this->product->id)
            ->assertJsonPath('products.0.med_name', 'Paracetamol')
            ->assertJsonPath('products.0.dose', '500mg')
            ->assertJsonPath('products.0.form', 'Tablet')
            ->assertJsonPath('products.0.brand_name', 'Bioflu')
            ->assertJsonPath('products.0.pack_size', 10)
            ->assertJsonPath('products.0.retail_price', '5.00')
            ->assertJsonPath('products.0.wholesale_price', '45.00')
            ->assertJsonPath('products.0.vat_status', 'VAT')
            ->assertJsonPath('products.0.effective_retail_price', 5.6)
            ->assertJsonPath('products.0.effective_wholesale_price', 50.4)
            ->assertJsonCount(2, 'products.0.batches');

        $batches = collect($response->json('products.0.batches'))->keyBy('lot_number');

        $this->assertSame(['LOT-001', 'LOT-LAPSED'], $batches->keys()->sort()->values()->all());
        $this->assertFalse($batches['LOT-001']['is_expired']);
        $this->assertSame(100, $batches['LOT-001']['quantity']);
        $this->assertSame('Active', $batches['LOT-001']['status']);
        $this->assertTrue($batches['LOT-LAPSED']['is_expired']);
        $this->assertSame('A-3', $batches['LOT-LAPSED']['shelf_number']);

        foreach (['id', 'product_id', 'lot_number', 'expiry', 'shelf_number', 'quantity', 'status', 'is_expired'] as $key) {
            $this->assertArrayHasKey($key, $batches['LOT-001']);
        }

        $this->actingAsWithSession($this->staff)
            ->getJson(route('medicine-inventory.products', ['branch_id' => $this->branchB->id]))
            ->assertForbidden();
    }
}
