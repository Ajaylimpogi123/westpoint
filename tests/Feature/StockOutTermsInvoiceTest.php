<?php

namespace Tests\Feature;

use App\Models\StockOut;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/** Terms and Invoice # are optional and printed on the delivery receipt. */
class StockOutTermsInvoiceTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    private function store(array $extra = [])
    {
        return $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.store'), array_merge([
                'transaction_subtype' => 'Delivery to Customer',
                'branch_id' => $this->branchA->id,
                'issued_by' => 'Issuer',
                'delivered_to' => 'ABC Clinic',
                'idempotency_key' => 'ti-'.uniqid(),
                'items' => [[
                    'pd_id' => $this->product->id,
                    'products_qty_id' => $this->batch->id,
                    'quantity_deducted' => 5,
                    'unit_type' => 'Piece',
                ]],
            ], $extra));
    }

    public function test_terms_and_invoice_are_optional(): void
    {
        $this->store()->assertSessionHasNoErrors()->assertSessionHas('success');

        $stockOut = StockOut::firstOrFail();
        $this->assertNull($stockOut->terms);
        $this->assertNull($stockOut->invoice_number);
    }

    public function test_terms_and_invoice_are_saved_shown_edited_and_printed(): void
    {
        $this->store(['terms' => '30 days', 'invoice_number' => 'INV-0042'])
            ->assertSessionHasNoErrors();

        $stockOut = StockOut::firstOrFail();

        $this->actingAsWithSession($this->admin)
            ->getJson(route('stock-out.show', $stockOut))
            ->assertJsonPath('stock_out.terms', '30 days')
            ->assertJsonPath('stock_out.invoice_number', 'INV-0042');

        $this->actingAsWithSession($this->admin)
            ->getJson(route('stock-out.edit', $stockOut))
            ->assertJsonPath('stock_out.invoice_number', 'INV-0042');

        $this->actingAsWithSession($this->admin)
            ->put(route('stock-out.update', $stockOut), [
                'issued_by' => 'Issuer',
                'delivered_to' => 'ABC Clinic',
                'terms' => 'COD',
                'invoice_number' => '',
                'items' => [[
                    'pd_id' => $this->product->id,
                    'products_qty_id' => $this->batch->id,
                    'quantity_deducted' => 5,
                    'unit_type' => 'Piece',
                ]],
            ])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $stockOut->refresh();
        $this->assertSame('COD', $stockOut->terms);
        $this->assertNull($stockOut->invoice_number);

        $this->actingAsWithSession($this->admin)
            ->get(route('stock-out.receipt', $stockOut))
            ->assertInertia(fn (Assert $page) => $page
                ->component('MedicineInventory/StockOutReceipt')
                ->where('stockOut.terms', 'COD'));
    }

    public function test_terms_and_invoice_have_a_length_limit(): void
    {
        $this->store(['terms' => str_repeat('a', 101), 'invoice_number' => str_repeat('1', 101)])
            ->assertSessionHasErrors(['terms', 'invoice_number']);
    }
}
