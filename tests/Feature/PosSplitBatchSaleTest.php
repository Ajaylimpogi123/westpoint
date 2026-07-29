<?php

namespace Tests\Feature;

use App\Models\PosCart;
use App\Models\ProductQty;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleItemAllocation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class PosSplitBatchSaleTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    public function test_box_sale_spanning_two_batches_keeps_one_commercial_line(): void
    {
        $this->batch->update([
            'quantity' => 6,
            'expiry' => now()->addDays(7)->toDateString(),
        ]);

        $secondBatch = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 200,
            'status' => 'Active',
            'lot_number' => 'LOT-002',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $cart = PosCart::create([
            'branch_id' => $this->branchA->id,
            'user_id' => $this->staff->id,
        ]);

        // 2 Box × pack_size 10 = 20 pieces (6 from LOT-001, 14 from LOT-002).
        $this->actingAsWithSession($this->staff)
            ->post('/pos', [
                'cart_id' => $cart->id,
                'items' => [[
                    'product_id' => $this->product->id,
                    'unit_type' => 'Box',
                    'quantity_sold' => 2,
                ]],
                'payment_method' => 'cash',
                'discount_amount' => 0,
                'amount_received' => 100,
            ])
            ->assertRedirect(route('pos.index'));

        $sale = Sale::query()->where('branch_id', $this->branchA->id)->first();
        $this->assertNotNull($sale);

        $items = SaleItem::query()->where('sale_id', $sale->id)->get();
        $this->assertCount(1, $items);

        $line = $items->first();
        $this->assertSame('Box', $line->unit_type);
        $this->assertSame(2, (int) $line->quantity_sold);
        $this->assertSame('90.00', $line->total_price);
        $this->assertSame((string) $this->batch->id, (string) $line->products_qty_id);

        $allocations = SaleItemAllocation::query()
            ->where('sale_item_id', $line->id)
            ->orderBy('products_qty_id')
            ->get();

        $this->assertCount(2, $allocations);
        $this->assertSame(6, (int) $allocations[0]->pieces);
        $this->assertSame((string) $this->batch->id, (string) $allocations[0]->products_qty_id);
        $this->assertSame(14, (int) $allocations[1]->pieces);
        $this->assertSame((string) $secondBatch->id, (string) $allocations[1]->products_qty_id);

        $this->assertSame(0, (int) $this->batch->fresh()->quantity);
        $this->assertSame(186, (int) $secondBatch->fresh()->quantity);
    }

    public function test_single_batch_sale_has_no_allocation_rows(): void
    {
        $cart = PosCart::create([
            'branch_id' => $this->branchA->id,
            'user_id' => $this->staff->id,
        ]);

        $this->actingAsWithSession($this->staff)
            ->post('/pos', [
                'cart_id' => $cart->id,
                'items' => [[
                    'product_id' => $this->product->id,
                    'unit_type' => 'Piece',
                    'quantity_sold' => 3,
                ]],
                'payment_method' => 'cash',
                'discount_amount' => 0,
                'amount_received' => 20,
            ])
            ->assertRedirect(route('pos.index'));

        $sale = Sale::query()->where('branch_id', $this->branchA->id)->first();
        $line = SaleItem::query()->where('sale_id', $sale->id)->sole();

        $this->assertSame('Piece', $line->unit_type);
        $this->assertSame(0, SaleItemAllocation::query()->where('sale_item_id', $line->id)->count());
    }
}
