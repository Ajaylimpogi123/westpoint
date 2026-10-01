<?php

namespace Tests\Feature;

use App\Enums\PaymentMethod;
use App\Models\PosCart;
use App\Models\Sale;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class PosPaymentMethodTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    private function checkout(string $paymentMethod, string $unitType, int $quantity, float $amountReceived)
    {
        $cart = PosCart::firstOrCreate([
            'branch_id' => $this->branchA->id,
            'user_id' => $this->staff->id,
        ]);

        return $this->actingAsWithSession($this->staff)
            ->post('/pos', [
                'cart_id' => $cart->id,
                'items' => [[
                    'product_id' => $this->product->id,
                    'unit_type' => $unitType,
                    'quantity_sold' => $quantity,
                ]],
                'payment_method' => $paymentMethod,
                'discount_amount' => 0,
                'amount_received' => $amountReceived,
                'idempotency_key' => (string) Str::uuid(),
            ]);
    }

    public static function posMethodProvider(): array
    {
        return array_combine(
            PaymentMethod::posValues(),
            array_map(fn ($value) => [$value], PaymentMethod::posValues())
        );
    }

    /**
     * @dataProvider posMethodProvider
     */
    public function test_every_pos_method_checks_out_by_piece(string $method): void
    {
        $this->checkout($method, 'Piece', 3, 100)
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('pos.index'));

        $sale = Sale::query()->sole();
        $this->assertSame($method, $sale->payment_method);
        $this->assertSame(97, (int) $this->batch->fresh()->quantity);
    }

    public function test_ph_gamot_box_sale_deducts_pack_size_pieces(): void
    {
        $this->checkout('PH_GAMOT', 'Box', 2, 90)
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('pos.index'));

        $sale = Sale::query()->sole();
        $this->assertSame('PH_GAMOT', $sale->payment_method);
        $this->assertSame('0.00', $sale->change_due);
        // 2 boxes × pack_size 10.
        $this->assertSame(80, (int) $this->batch->fresh()->quantity);
    }

    public function test_unknown_or_mis_spaced_methods_are_rejected(): void
    {
        // (Leading/trailing spaces are stripped by TrimStrings, so " PH_GAMOT"
        // is accepted as PH_GAMOT; wrong casing / non-POS values are not.)
        foreach (['ph gamot', 'ph_gamot', 'Delivery to Customer', 'bitcoin', ''] as $method) {
            $this->checkout($method, 'Piece', 1, 100)
                ->assertSessionHasErrors('payment_method');
        }

        $this->assertSame(0, Sale::query()->count());
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }
}
