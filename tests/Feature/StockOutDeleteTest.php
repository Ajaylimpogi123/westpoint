<?php

namespace Tests\Feature;

use App\Models\InventoryMovementLog;
use App\Models\Sale;
use App\Models\StockOut;
use App\Models\StockOutItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/** A stock-out can be deleted until it becomes a sale. */
class StockOutDeleteTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    private function store(string $subtype, int $pieces): StockOut
    {
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), [
                'transaction_subtype' => $subtype,
                'branch_id' => $this->branchA->id,
                'issued_by' => 'Issuer',
                'delivered_to' => 'ABC Clinic',
                'idempotency_key' => 'del-'.uniqid(),
                'items' => [[
                    'pd_id' => $this->product->id,
                    'products_qty_id' => $this->batch->id,
                    'quantity_deducted' => $pieces,
                    'unit_type' => 'Piece',
                ]],
            ])
            ->assertSessionHasNoErrors();

        return StockOut::latest('stock_out_id')->firstOrFail();
    }

    public function test_pending_delivery_is_deleted_without_touching_stock(): void
    {
        $stockOut = $this->store('Delivery to Customer', 30);

        $this->actingAsWithSession($this->admin)
            ->delete(route('stock-out.destroy', $stockOut))
            ->assertSessionHas('success', "Stock Out #{$stockOut->stock_out_id} deleted.");

        $this->assertNull(StockOut::find($stockOut->stock_out_id));
        $this->assertSame(0, StockOutItem::count());
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(0, InventoryMovementLog::where('reference_id', $stockOut->stock_out_id)->count());
    }

    public function test_deleting_a_return_puts_its_pieces_back(): void
    {
        $stockOut = $this->store('Returned to supplier', 30);
        $this->assertSame(70, (int) $this->batch->fresh()->quantity);

        $this->actingAsWithSession($this->superadmin)
            ->delete(route('stock-out.destroy', $stockOut))
            ->assertSessionHas('success');

        $this->assertNull(StockOut::find($stockOut->stock_out_id));
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(30, (int) InventoryMovementLog::query()
            ->where('reference_id', $stockOut->stock_out_id)
            ->where('remarks', 'Stock-out deleted')
            ->value('quantity'));
    }

    public function test_delivery_added_to_sales_cannot_be_deleted(): void
    {
        $stockOut = $this->store('Delivery to Customer', 30);

        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.confirm-delivery', $stockOut))
            ->assertSessionHas('success');

        $this->actingAsWithSession($this->admin)
            ->delete(route('stock-out.destroy', $stockOut))
            ->assertSessionHas('error', 'This stock-out can no longer be deleted.');

        $this->assertNotNull(StockOut::find($stockOut->stock_out_id));
        $this->assertSame(70, (int) $this->batch->fresh()->quantity);
        $this->assertSame(1, Sale::count());
    }

    public function test_legacy_dispense_cannot_be_deleted(): void
    {
        $legacy = StockOut::create([
            'transaction_subtype' => 'Dispensed to patient',
            'branch_id' => $this->branchA->id,
            'issued_by' => 'Old',
        ]);

        $this->actingAsWithSession($this->admin)
            ->delete(route('stock-out.destroy', $legacy))
            ->assertSessionHas('error');

        $this->assertNotNull(StockOut::find($legacy->stock_out_id));
    }

    public function test_staff_cannot_delete(): void
    {
        $stockOut = $this->store('Delivery to Customer', 5);

        $this->actingAsWithSession($this->staff)
            ->delete(route('stock-out.destroy', $stockOut))
            ->assertForbidden();

        $this->assertNotNull(StockOut::find($stockOut->stock_out_id));
    }

    public function test_deleted_delivery_cannot_then_be_added_to_sales(): void
    {
        $stockOut = $this->store('Delivery to Customer', 5);

        $this->actingAsWithSession($this->admin)->delete(route('stock-out.destroy', $stockOut));

        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.confirm-delivery', $stockOut->stock_out_id))
            ->assertNotFound();

        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(0, Sale::count());
    }
}
