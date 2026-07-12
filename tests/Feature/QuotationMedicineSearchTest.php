<?php

namespace Tests\Feature;

use App\Models\MedicineProduct;
use App\Models\ProductQty;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class QuotationMedicineSearchTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    public function test_staff_can_search_medicines_in_their_branch(): void
    {
        $response = $this->actingAsWithSession($this->staff)
            ->getJson('/quotations/medicines/search?search=Para');

        $response->assertOk()
            ->assertJsonPath('products.0.med_name', 'Paracetamol')
            ->assertJsonPath('products.0.label', 'Tablet - Paracetamol 500mg (Bioflu)');
    }

    public function test_staff_can_fetch_medicine_detail_with_lots_and_prices(): void
    {
        $response = $this->actingAsWithSession($this->staff)
            ->getJson("/quotations/medicines/{$this->product->id}");

        $response->assertOk()
            ->assertJsonPath('id', $this->product->id)
            ->assertJsonPath('description', 'Tablet - Paracetamol 500mg (Bioflu)')
            ->assertJsonPath('default_unit', 'PIECE')
            ->assertJsonPath('default_price', '5.00')
            ->assertJsonPath('retail_price', '5.00')
            ->assertJsonPath('wholesale_price', '45.00')
            ->assertJsonPath('primary_lot.lot_number', 'LOT-001')
            ->assertJsonCount(1, 'lots');
    }

    public function test_search_excludes_products_from_other_branches(): void
    {
        $otherBranchProduct = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Paracetamol Extra',
            'dose' => '500mg',
            'form' => 'Tablet',
            'pack_size' => 10,
            'brand_name' => 'Other Brand',
            'retail_price' => 6.00,
            'wholesale_price' => 50.00,
            'status' => 'Active',
            'is_generic' => false,
        ]);

        ProductQty::create([
            'product_id' => $otherBranchProduct->id,
            'quantity' => 50,
            'status' => 'Active',
            'lot_number' => 'LOT-OTHER',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $response = $this->actingAsWithSession($this->staff)
            ->getJson('/quotations/medicines/search?search=Paracetamol');

        $response->assertOk();

        $names = collect($response->json('products'))->pluck('med_name')->all();

        $this->assertContains('Paracetamol', $names);
        $this->assertNotContains('Paracetamol Extra', $names);
    }

    public function test_search_excludes_products_without_active_stock(): void
    {
        $outOfStockProduct = MedicineProduct::create([
            'branch_id' => $this->branchA->id,
            'med_name' => 'Empty Stock Med',
            'dose' => '250mg',
            'form' => 'Capsule',
            'pack_size' => 10,
            'brand_name' => 'No Stock',
            'retail_price' => 10.00,
            'wholesale_price' => 90.00,
            'status' => 'Active',
            'is_generic' => false,
        ]);

        ProductQty::create([
            'product_id' => $outOfStockProduct->id,
            'quantity' => 0,
            'status' => 'Active',
            'lot_number' => 'LOT-ZERO',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $response = $this->actingAsWithSession($this->staff)
            ->getJson('/quotations/medicines/search?search=Empty');

        $response->assertOk()
            ->assertJsonCount(0, 'products');
    }

    public function test_show_returns_not_found_for_other_branch_product(): void
    {
        $otherBranchProduct = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Branch B Only',
            'dose' => '500mg',
            'form' => 'Tablet',
            'pack_size' => 10,
            'brand_name' => 'Branch B',
            'retail_price' => 6.00,
            'wholesale_price' => 50.00,
            'status' => 'Active',
            'is_generic' => false,
        ]);

        ProductQty::create([
            'product_id' => $otherBranchProduct->id,
            'quantity' => 50,
            'status' => 'Active',
            'lot_number' => 'LOT-B',
            'expiry' => now()->addYear()->toDateString(),
        ]);

        $this->actingAsWithSession($this->staff)
            ->getJson("/quotations/medicines/{$otherBranchProduct->id}")
            ->assertNotFound();
    }
}
