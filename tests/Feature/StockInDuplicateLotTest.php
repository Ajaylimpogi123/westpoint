<?php

namespace Tests\Feature;

use App\Models\ProductQty;
use App\Services\InventoryStockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class StockInDuplicateLotTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    public function test_stock_in_merges_when_lot_expiry_and_shelf_match(): void
    {
        $expiry = now()->addYear()->toDateString();

        $this->batch->update([
            'quantity' => 50,
            'expiry' => $expiry,
            'shelf_number' => 'A-01',
        ]);

        $this->actingAsWithSession($this->staff)
            ->post(route('stock-in.store'), [
                'supplier_name' => 'Acme Pharma',
                'delivery_date' => now()->toDateString(),
                'branch_id' => $this->branchA->id,
                'received_by' => 'Staff User',
                'items' => [[
                    'pd_id' => $this->product->id,
                    'batch_number' => 'LOT-001',
                    'expiry_date' => $expiry,
                    'quantity_received' => 10,
                    'shelf_number' => 'A-01',
                    'unit_type' => 'Piece',
                ]],
            ])
            ->assertRedirect();

        $this->assertDatabaseCount('products_qty', 1);
        $this->assertSame(60, (int) $this->batch->fresh()->quantity);
    }

    public function test_stock_in_rejects_duplicate_lot_with_different_expiry_without_confirmation(): void
    {
        $this->batch->update([
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $this->actingAsWithSession($this->staff)
            ->from(route('medicine-inventory.index'))
            ->post(route('stock-in.store'), [
                'supplier_name' => 'Acme Pharma',
                'delivery_date' => now()->toDateString(),
                'branch_id' => $this->branchA->id,
                'received_by' => 'Staff User',
                'items' => [[
                    'pd_id' => $this->product->id,
                    'batch_number' => 'LOT-001',
                    'expiry_date' => now()->addYears(2)->toDateString(),
                    'quantity_received' => 5,
                    'shelf_number' => '',
                    'unit_type' => 'Piece',
                    'confirm_duplicate_lot' => false,
                ]],
            ])
            ->assertRedirect(route('medicine-inventory.index'))
            ->assertSessionHas('error');

        $this->assertDatabaseCount('products_qty', 1);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_stock_in_allows_duplicate_lot_with_different_expiry_when_confirmed(): void
    {
        $this->batch->update([
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $newExpiry = now()->addYears(2)->toDateString();

        $this->actingAsWithSession($this->staff)
            ->post(route('stock-in.store'), [
                'supplier_name' => 'Acme Pharma',
                'delivery_date' => now()->toDateString(),
                'branch_id' => $this->branchA->id,
                'received_by' => 'Staff User',
                'items' => [[
                    'pd_id' => $this->product->id,
                    'batch_number' => 'LOT-001',
                    'expiry_date' => $newExpiry,
                    'quantity_received' => 5,
                    'shelf_number' => '',
                    'unit_type' => 'Piece',
                    'confirm_duplicate_lot' => true,
                ]],
            ])
            ->assertRedirect();

        $this->assertDatabaseCount('products_qty', 2);

        $this->assertDatabaseHas('products_qty', [
            'product_id' => $this->product->id,
            'lot_number' => 'LOT-001',
            'quantity' => 5,
        ]);
    }

    public function test_stock_in_intent_detects_shelf_split_without_expiry_conflict(): void
    {
        $expiry = now()->addYear()->toDateString();

        $this->batch->update([
            'expiry' => $expiry,
            'shelf_number' => 'A-01',
        ]);

        $intent = InventoryStockService::stockInIntent(
            $this->product->id,
            $this->branchA->id,
            'LOT-001',
            $expiry,
            'B-02',
        );

        $this->assertSame(InventoryStockService::STOCK_IN_INTENT_SHELF_SPLIT, $intent);
    }

    public function test_stock_in_creates_separate_row_for_different_shelf_same_lot_and_expiry(): void
    {
        $expiry = now()->addYear()->toDateString();

        $this->batch->update([
            'quantity' => 40,
            'expiry' => $expiry,
            'shelf_number' => 'A-01',
        ]);

        $this->actingAsWithSession($this->staff)
            ->post(route('stock-in.store'), [
                'supplier_name' => 'Acme Pharma',
                'delivery_date' => now()->toDateString(),
                'branch_id' => $this->branchA->id,
                'received_by' => 'Staff User',
                'items' => [[
                    'pd_id' => $this->product->id,
                    'batch_number' => 'LOT-001',
                    'expiry_date' => $expiry,
                    'quantity_received' => 10,
                    'shelf_number' => 'B-02',
                    'unit_type' => 'Piece',
                ]],
            ])
            ->assertRedirect();

        $this->assertDatabaseCount('products_qty', 2);
        $this->assertSame(40, (int) $this->batch->fresh()->quantity);

        $newBatch = ProductQty::query()
            ->where('product_id', $this->product->id)
            ->where('shelf_number', 'B-02')
            ->first();

        $this->assertNotNull($newBatch);
        $this->assertSame(10, (int) $newBatch->quantity);
    }
}
