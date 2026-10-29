<?php

namespace Tests\Feature;

use App\Models\InventoryMovementLog;
use App\Models\ProductQty;
use App\Models\StockOut;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * A "Returned to supplier" stock-out takes its stock when saved, so editing
 * it moves stock by the net change per lot.
 */
class StockOutReturnEditTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    private ProductQty $lot2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();

        $this->lot2 = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 50,
            'status' => 'Active',
            'lot_number' => 'LOT-002',
            'expiry' => now()->addYears(2)->toDateString(),
        ]);
    }

    private function line(int $pieces, ?ProductQty $lot = null): array
    {
        return [
            'pd_id' => $this->product->id,
            'products_qty_id' => ($lot ?? $this->batch)->id,
            'quantity_deducted' => $pieces,
            'unit_type' => 'Piece',
        ];
    }

    private function storeReturn(array $items): StockOut
    {
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), [
                'transaction_subtype' => 'Returned to supplier',
                'branch_id' => $this->branchA->id,
                'issued_by' => 'Issuer',
                'idempotency_key' => 'ret-'.uniqid(),
                'items' => $items,
            ])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        return StockOut::latest('stock_out_id')->firstOrFail();
    }

    private function update(StockOut $stockOut, array $items, array $extra = [])
    {
        return $this->actingAsWithSession($this->admin)
            ->put(route('stock-out.update', $stockOut), array_merge([
                'issued_by' => 'Issuer',
                'items' => $items,
            ], $extra));
    }

    public function test_return_can_be_loaded_for_edit_without_a_recipient(): void
    {
        $stockOut = $this->storeReturn([$this->line(30)]);

        $this->actingAsWithSession($this->admin)
            ->getJson(route('stock-out.edit', $stockOut))
            ->assertOk()
            ->assertJsonPath('stock_out.transaction_subtype', 'Returned to supplier');

        $this->update($stockOut, [$this->line(30)], ['remarks' => 'Damaged boxes'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame('Damaged boxes', $stockOut->fresh()->remarks);
        $this->assertSame(70, (int) $this->batch->fresh()->quantity);
    }

    public function test_lowering_a_quantity_puts_the_difference_back(): void
    {
        $stockOut = $this->storeReturn([$this->line(30)]);

        $this->update($stockOut, [$this->line(10)])->assertSessionHas('success');

        $this->assertSame(90, (int) $this->batch->fresh()->quantity);
        $this->assertSame(10, (int) $stockOut->items()->sum('pieces_deducted'));
        $this->assertSame(20, (int) InventoryMovementLog::query()
            ->where('reference_id', $stockOut->stock_out_id)
            ->where('remarks', 'Stock-out edited')
            ->value('quantity'));
    }

    public function test_raising_a_quantity_can_use_the_pieces_it_already_holds(): void
    {
        // The lot has 100; the return takes 100, so the lot is empty.
        $stockOut = $this->storeReturn([$this->line(100)]);
        $this->assertSame(0, (int) $this->batch->fresh()->quantity);

        // Keeping all 100 must still validate even though the lot shows 0.
        $this->update($stockOut, [$this->line(100)])->assertSessionHasNoErrors()->assertSessionHas('success');

        // More than it holds plus what is left is refused, and nothing moves.
        $this->update($stockOut, [$this->line(101)])->assertSessionHasErrors('items.0.quantity_deducted');
        $this->assertSame(0, (int) $this->batch->fresh()->quantity);
        $this->assertSame(100, (int) $stockOut->items()->sum('pieces_deducted'));
    }

    public function test_switching_lots_restores_the_old_lot_and_takes_from_the_new(): void
    {
        $stockOut = $this->storeReturn([$this->line(30)]);

        $this->update($stockOut, [$this->line(20, $this->lot2)])->assertSessionHas('success');

        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
        $this->assertSame(30, (int) $this->lot2->fresh()->quantity);
        $this->assertSame($this->lot2->id, (int) $stockOut->items()->value('products_qty_id'));
    }

    public function test_emptied_lot_turns_active_again_when_pieces_are_put_back(): void
    {
        $stockOut = $this->storeReturn([$this->line(100)]);
        $this->assertSame(ProductQty::STATUS_INACTIVE, $this->batch->fresh()->status);

        $this->update($stockOut, [$this->line(60)])->assertSessionHas('success');

        $batch = $this->batch->fresh();
        $this->assertSame(40, (int) $batch->quantity);
        $this->assertSame(ProductQty::STATUS_ACTIVE, $batch->status);
    }

    public function test_confirmed_delivery_and_legacy_dispense_stay_locked(): void
    {
        $legacy = StockOut::create([
            'transaction_subtype' => 'Dispensed to patient',
            'branch_id' => $this->branchA->id,
            'issued_by' => 'Old',
        ]);

        $this->actingAsWithSession($this->admin)
            ->getJson(route('stock-out.edit', $legacy))
            ->assertForbidden();

        $this->update($legacy, [$this->line(1)])
            ->assertSessionHas('error', 'This stock-out can no longer be edited.');
    }
}
