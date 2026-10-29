<?php

namespace Tests\Feature;

use App\Models\InventoryMovementLog;
use App\Models\Sale;
use App\Models\StockOut;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * "Add to Sales" on a Delivery to Customer: stock leaves the lot and a sale
 * is recorded, together, only at that moment.
 */
class StockOutAddToSalesTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    public function test_add_to_sales_deducts_the_lot_and_records_the_sale(): void
    {
        // 2 boxes of 12 (the product's stored pack size is 10).
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), [
                'transaction_subtype' => 'Delivery to Customer',
                'branch_id' => $this->branchA->id,
                'issued_by' => 'Issuer',
                'delivered_to' => 'ABC Clinic',
                'idempotency_key' => 'ats-'.uniqid(),
                'items' => [[
                    'pd_id' => $this->product->id,
                    'products_qty_id' => $this->batch->id,
                    'quantity_deducted' => 2,
                    'unit_type' => 'Box',
                    'pieces_per_box' => 12,
                ]],
            ])
            ->assertSessionHasNoErrors();

        $stockOut = StockOut::firstOrFail();

        // Recording the delivery takes nothing yet.
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(0, Sale::count());

        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.confirm-delivery', $stockOut))
            ->assertSessionHas('success', 'Delivery confirmed and added to sales.');

        $this->assertSame(76, (int) $this->batch->fresh()->quantity);
        $this->assertTrue((bool) $stockOut->fresh()->delivery_confirmed);

        $sale = Sale::with('items')->sole();
        $this->assertSame('Delivery to Customer', $sale->payment_method);
        $this->assertSame("Stock Out #{$stockOut->stock_out_id}", $sale->reference_number);
        $this->assertEquals(90.00, (float) $sale->net_amount); // 2 boxes x 45.00 wholesale

        $line = $sale->items->sole();
        $this->assertSame(2, (int) $line->quantity_sold);
        $this->assertSame(24, $line->piecesSold());

        $this->assertSame(-24, (int) InventoryMovementLog::query()
            ->where('reference_id', $stockOut->stock_out_id)
            ->value('quantity'));

        // A second click cannot deduct or sell twice.
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.confirm-delivery', $stockOut))
            ->assertSessionHas('error');

        $this->assertSame(76, (int) $this->batch->fresh()->quantity);
        $this->assertSame(1, Sale::count());
    }
}
