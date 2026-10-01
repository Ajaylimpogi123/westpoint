<?php

namespace Tests\Feature\Qa;

use App\Models\PosCart;
use App\Models\Sale;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * QA black-box tests for dashboard-payment-alignment: every payment method the
 * POS checkout offers must be accepted by POST /pos and stored verbatim, so the
 * dashboard filter and History labels have something to align with.
 */
class PosPaymentMethodCheckoutTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    /** Canonical POS payment methods (value => POS label). */
    public const POS_METHODS = [
        'cash' => 'Cash',
        'gcash' => 'GCash',
        'debit_card' => 'Debit Card',
        'credit_card' => 'Credit Card',
        'PH_GAMOT' => 'PH GAMOT',
        'bank_transfer' => 'Bank Transfer',
        'others' => 'Others',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    public static function posMethods(): array
    {
        $cases = [];

        foreach (array_keys(self::POS_METHODS) as $method) {
            $cases[$method] = [$method];
        }

        return $cases;
    }

    private function checkout(string $method, array $overrides = [])
    {
        // One cart per (branch, user); a successful checkout deletes it.
        $cart = PosCart::firstOrCreate([
            'branch_id' => $this->branchA->id,
            'user_id' => $this->staff->id,
        ]);

        return $this->actingAsWithSession($this->staff)->post('/pos', array_merge([
            'cart_id' => $cart->id,
            'items' => [[
                'product_id' => $this->product->id,
                'unit_type' => 'Piece',
                'quantity_sold' => 2,
            ]],
            'payment_method' => $method,
            'reference_number' => $method === 'cash' ? null : 'REF-'.$method,
            'discount_amount' => 0,
            'amount_received' => 10,
        ], $overrides));
    }

    /**
     * AC-1: each POS payment method checks out and is stored verbatim.
     *
     * @dataProvider posMethods
     */
    public function test_pos_checkout_accepts_every_pos_payment_method(string $method): void
    {
        $this->checkout($method)
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('pos.index'))
            ->assertSessionHas('success');

        $sale = Sale::query()->where('branch_id', $this->branchA->id)->sole();

        $this->assertSame($method, $sale->payment_method);
        $this->assertSame('10.00', (string) $sale->net_amount);
        $this->assertSame(98, (int) $this->batch->fresh()->quantity);
    }

    /** AC-2: unknown or empty payment methods are rejected and nothing is sold. */
    public function test_pos_checkout_rejects_unknown_payment_method(): void
    {
        foreach (['bitcoin', '', 'ph gamot'] as $bad) {
            $this->checkout($bad)->assertSessionHasErrors('payment_method');
        }

        $this->assertSame(0, Sale::query()->count());
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);
    }

    /** AC-3: a Box sale paid with PH_GAMOT deducts pack_size pieces per box. */
    public function test_ph_gamot_box_sale_deducts_pieces(): void
    {
        $this->checkout('PH_GAMOT', [
            'items' => [[
                'product_id' => $this->product->id,
                'unit_type' => 'Box',
                'quantity_sold' => 1,
            ]],
            'amount_received' => 45,
        ])->assertSessionHasNoErrors()->assertRedirect(route('pos.index'));

        $sale = Sale::query()->sole();
        $this->assertSame('PH_GAMOT', $sale->payment_method);
        $this->assertSame('45.00', (string) $sale->net_amount);
        $this->assertSame(90, (int) $this->batch->fresh()->quantity);
    }

    /** AC-4: a duplicate PH_GAMOT submit with the same idempotency_key sells once. */
    public function test_duplicate_ph_gamot_submit_with_same_idempotency_key_sells_once(): void
    {
        $cart = PosCart::create([
            'branch_id' => $this->branchA->id,
            'user_id' => $this->staff->id,
        ]);

        $payload = [
            'cart_id' => $cart->id,
            'items' => [[
                'product_id' => $this->product->id,
                'unit_type' => 'Piece',
                'quantity_sold' => 2,
            ]],
            'payment_method' => 'PH_GAMOT',
            'reference_number' => 'PHG-1',
            'discount_amount' => 0,
            'amount_received' => 10,
            'idempotency_key' => 'qa-phgamot-dup-1',
        ];

        $this->actingAsWithSession($this->staff)->post('/pos', $payload)
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('pos.index'));
        $this->actingAsWithSession($this->staff)->post('/pos', $payload);

        $this->assertSame(1, Sale::query()->count());
        $this->assertSame(98, (int) $this->batch->fresh()->quantity);
    }

    /** AC-5: cash still requires amount_received >= net; non-cash has zero change. */
    public function test_cash_underpayment_rejected_and_non_cash_has_no_change(): void
    {
        $this->checkout('cash', ['amount_received' => 5])
            ->assertSessionHas('error');
        $this->assertSame(0, Sale::query()->count());
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);

        $this->checkout('bank_transfer', ['amount_received' => 10])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('pos.index'));

        $sale = Sale::query()->sole();
        $this->assertSame('bank_transfer', $sale->payment_method);
        $this->assertSame('0.00', (string) $sale->change_due);
    }
}
