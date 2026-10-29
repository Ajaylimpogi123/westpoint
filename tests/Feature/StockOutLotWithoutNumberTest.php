<?php

namespace Tests\Feature;

use App\Models\ProductQty;
use App\Models\StockOut;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * Stock can be added without a lot number or expiry. Picking such a lot in
 * a stock-out used to fail with "Column 'lot_number' cannot be null".
 */
class StockOutLotWithoutNumberTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    private ProductQty $unnumbered;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();

        $this->unnumbered = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 300,
            'status' => 'Active',
            'lot_number' => null,
            'expiry' => null,
        ]);
    }

    private function store(string $subtype, int $pieces)
    {
        return $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), [
                'transaction_subtype' => $subtype,
                'branch_id' => $this->branchA->id,
                'issued_by' => 'Issuer',
                'delivered_to' => 'JESUS THE CORNER STONE CHRISTIAN CENTER, INC.',
                'idempotency_key' => 'nolot-'.uniqid(),
                'items' => [[
                    'pd_id' => $this->product->id,
                    'products_qty_id' => $this->unnumbered->id,
                    'quantity_deducted' => $pieces,
                    'unit_type' => 'Piece',
                ]],
            ]);
    }

    public function test_delivery_from_a_lot_without_number_saves_and_confirms(): void
    {
        $this->store('Delivery to Customer', 250)
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $stockOut = StockOut::firstOrFail();
        $item = $stockOut->items()->firstOrFail();
        $this->assertNull($item->lot_number);
        $this->assertSame(250, (int) $item->pieces_deducted);

        $this->actingAsWithSession($this->admin)
            ->get(route('stock-out.receipt', $stockOut))
            ->assertOk();

        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.confirm-delivery', $stockOut))
            ->assertSessionHas('success');

        $this->assertSame(50, (int) $this->unnumbered->fresh()->quantity);
    }

    public function test_return_to_supplier_from_a_lot_without_number_saves(): void
    {
        $this->store('Returned to supplier', 100)
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame(200, (int) $this->unnumbered->fresh()->quantity);
    }
}
