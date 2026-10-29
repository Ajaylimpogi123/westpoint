<?php

namespace Tests\Feature;

use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\StockOut;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class StockOutTinAndBasketTest extends TestCase
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
            'delivered_to' => $subtype === 'Delivery to Customer' ? 'ABC Clinic' : null,
            'idempotency_key' => 'so-'.uniqid(),
            'items' => $items,
        ], $extra);
    }

    private function line(int $pieces, ?int $batchId = null, ?int $productId = null): array
    {
        return [
            'pd_id' => $productId ?? $this->product->id,
            'products_qty_id' => $batchId ?? $this->batch->id,
            'quantity_deducted' => $pieces,
            'unit_type' => 'Piece',
        ];
    }

    public function test_tin_is_saved_and_shown_on_view_and_receipt(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), $this->payload('Delivery to Customer', [$this->line(5)], [
                'delivered_to' => 'ABC Clinic',
                'delivered_to_tin' => '123-456-789-00000',
                'delivered_to_address' => 'Bacolod City',
            ]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $stockOut = StockOut::firstOrFail();
        $this->assertSame('123-456-789-00000', $stockOut->delivered_to_tin);

        $this->actingAsWithSession($this->admin)
            ->getJson(route('stock-out.show', $stockOut))
            ->assertJsonPath('stock_out.delivered_to_tin', '123-456-789-00000');

        $this->actingAsWithSession($this->admin)
            ->get(route('stock-out.receipt', $stockOut))
            ->assertInertia(fn (Assert $page) => $page
                ->component('MedicineInventory/StockOutReceipt')
                ->where('stockOut.delivered_to_tin', '123-456-789-00000'));
    }

    public function test_tin_can_be_edited_on_a_pending_delivery(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), $this->payload('Delivery to Customer', [$this->line(5)]));

        $stockOut = StockOut::firstOrFail();

        $this->actingAsWithSession($this->admin)
            ->getJson(route('stock-out.edit', $stockOut))
            ->assertJsonPath('stock_out.delivered_to_tin', null);

        $this->actingAsWithSession($this->admin)
            ->put(route('stock-out.update', $stockOut), [
                'issued_by' => 'Issuer',
                'delivered_to' => 'ABC Clinic',
                'delivered_to_tin' => '999-888-777-00000',
                'items' => [$this->line(5)],
            ])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame('999-888-777-00000', $stockOut->fresh()->delivered_to_tin);
    }

    public function test_tin_longer_than_50_characters_is_rejected(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), $this->payload('Delivery to Customer', [$this->line(5)], [
                'delivered_to_tin' => str_repeat('9', 51),
            ]))
            ->assertSessionHasErrors('delivered_to_tin');
    }

    public function test_delivery_with_same_lot_on_two_lines_cannot_exceed_the_lot(): void
    {
        // The seeded lot holds 100 pieces; each line alone fits, together they don't.
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), $this->payload('Delivery to Customer', [
                $this->line(60),
                $this->line(60),
            ]))
            ->assertSessionHasErrors([
                'items.1.quantity_deducted' => 'Line 2: lines 1 and 2 together take 120 pieces of Paracetamol from lot LOT-001, but only 100 pieces are available.',
            ]);

        $this->assertSame(0, StockOut::count());
    }

    public function test_update_with_same_lot_on_two_lines_cannot_exceed_the_lot(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), $this->payload('Delivery to Customer', [$this->line(5)]));

        $stockOut = StockOut::firstOrFail();

        $this->actingAsWithSession($this->admin)
            ->put(route('stock-out.update', $stockOut), [
                'issued_by' => 'Issuer',
                'delivered_to' => 'ABC Clinic',
                'items' => [$this->line(70), $this->line(70)],
            ])
            ->assertSessionHasErrors('items.1.quantity_deducted');

        $this->assertSame(5, (int) $stockOut->items()->sum('pieces_deducted'));
    }

    public function test_return_to_supplier_failure_rolls_back_every_line(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), $this->payload('Returned to supplier', [
                $this->line(60),
                $this->line(60),
            ]))
            ->assertSessionHasErrors('items.1.quantity_deducted');

        $this->assertSame(0, StockOut::count());
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    public function test_large_basket_with_many_medicines_saves_in_one_go(): void
    {
        $items = [];

        for ($i = 1; $i <= 40; $i++) {
            $product = MedicineProduct::create([
                'branch_id' => $this->branchA->id,
                'med_name' => "Medicine {$i}",
                'pack_size' => 10,
                'retail_price' => 1,
                'wholesale_price' => 9,
                'status' => 'Active',
            ]);

            $lot = ProductQty::create([
                'product_id' => $product->id,
                'quantity' => 50,
                'status' => 'Active',
                'lot_number' => "LOT-{$i}",
                'expiry' => now()->addYear()->toDateString(),
            ]);

            $items[] = $this->line(3, $lot->id, $product->id);
        }

        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), $this->payload('Returned to supplier', $items, [
                'delivered_to_tin' => '123-456-789-00000',
            ]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $stockOut = StockOut::firstOrFail();
        $this->assertSame(40, $stockOut->items()->count());
        $this->assertSame(120, (int) $stockOut->items()->sum('pieces_deducted'));
        $this->assertSame(40, ProductQty::where('quantity', 47)->count());
    }
}
