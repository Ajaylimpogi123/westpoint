<?php

namespace Tests\Feature;

use App\Models\MedicineProduct;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class MedicineMultiBranchTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    private function medicinePayload(array $overrides = []): array
    {
        return array_merge([
            'med_name' => 'Cetirizine',
            'dose' => '10mg',
            'form' => 'Tablet',
            'brand_name' => 'Virlix',
            'pack_size' => 10,
            'retail_price' => 3,
            'wholesale_price' => 25,
            'vat_status' => 'Non-VAT',
        ], $overrides);
    }

    public function test_admin_can_add_one_medicine_to_several_branches(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post('/medicine-inventory', $this->medicinePayload([
                'branch_ids' => [$this->branchA->id, $this->branchB->id],
            ]))
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        foreach ([$this->branchA, $this->branchB] as $branch) {
            $this->assertDatabaseHas('tbl_products', [
                'med_name' => 'Cetirizine',
                'branch_id' => $branch->id,
                'pack_size' => 10,
            ]);
        }
    }

    public function test_admin_defaults_to_session_branch_when_none_selected(): void
    {
        $this->actingAsWithSession($this->superadmin)
            ->post('/medicine-inventory', $this->medicinePayload())
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('tbl_products', [
            'med_name' => 'Cetirizine',
            'branch_id' => $this->branchA->id,
        ]);
    }

    public function test_staff_cannot_add_medicine_to_another_branch(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post('/medicine-inventory', $this->medicinePayload([
                'branch_ids' => [$this->branchB->id],
            ]))
            ->assertSessionHasErrors('branch_ids');

        $this->assertDatabaseMissing('tbl_products', ['med_name' => 'Cetirizine']);
    }

    public function test_duplicate_is_rejected_ignoring_case_and_spacing(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post('/medicine-inventory', $this->medicinePayload([
                'med_name' => '  paracetamol ',
                'dose' => '500MG',
                'form' => 'tablet',
                'brand_name' => 'bioflu',
            ]))
            ->assertSessionHasErrors('med_name');

        $this->assertSame(1, MedicineProduct::where('branch_id', $this->branchA->id)
            ->where('med_name', 'like', '%paracetamol%')
            ->count());
    }

    public function test_multi_branch_add_is_all_or_nothing_when_one_branch_has_it(): void
    {
        // branchA already has Paracetamol 500mg Tablet (Bioflu) from the seed.
        $this->actingAsWithSession($this->admin)
            ->post('/medicine-inventory', $this->medicinePayload([
                'branch_ids' => [$this->branchA->id, $this->branchB->id],
                'med_name' => 'Paracetamol',
                'dose' => '500mg',
                'form' => 'Tablet',
                'brand_name' => 'Bioflu',
            ]))
            ->assertSessionHasErrors('med_name');

        $this->assertDatabaseMissing('tbl_products', [
            'med_name' => 'Paracetamol',
            'branch_id' => $this->branchB->id,
        ]);
    }

    public function test_names_are_trimmed_and_whitespace_collapsed_on_save(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post('/medicine-inventory', $this->medicinePayload([
                'med_name' => '  Cetirizine   Hydrochloride ',
            ]))
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('tbl_products', [
            'med_name' => 'Cetirizine Hydrochloride',
        ]);
    }

    public function test_admin_can_copy_medicine_to_another_branch(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post("/medicine-inventory/{$this->product->id}/copy", [
                'branch_ids' => [$this->branchB->id],
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $copy = MedicineProduct::where('branch_id', $this->branchB->id)->firstOrFail();

        $this->assertSame('Paracetamol', $copy->med_name);
        $this->assertSame(10, $copy->pack_size);
        $this->assertSame('45.00', $copy->wholesale_price);
        $this->assertSame(0, $copy->batches()->count());
    }

    public function test_copy_rejects_branch_that_already_has_it(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post("/medicine-inventory/{$this->product->id}/copy", [
                'branch_ids' => [$this->branchA->id],
            ])
            ->assertSessionHasErrors('branch_ids');
    }

    public function test_staff_cannot_copy_medicine(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post("/medicine-inventory/{$this->product->id}/copy", [
                'branch_ids' => [$this->branchB->id],
            ])
            ->assertForbidden();
    }

    public function test_branch_presence_lists_branches_with_same_medicine(): void
    {
        MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'PARACETAMOL',
            'dose' => '500mg',
            'form' => 'Tablet',
            'brand_name' => 'Bioflu',
            'pack_size' => 10,
            'retail_price' => 5,
            'wholesale_price' => 45,
            'status' => 'Active',
        ]);

        $response = $this->actingAsWithSession($this->admin)
            ->getJson("/medicine-inventory/{$this->product->id}/branches")
            ->assertOk();

        $this->assertEqualsCanonicalizing(
            [$this->branchA->id, $this->branchB->id],
            $response->json('branch_ids'),
        );
    }

    public function test_catalog_suggests_existing_medicine_with_its_branches(): void
    {
        $this->actingAsWithSession($this->staff)
            ->getJson('/medicine-inventory/catalog?search=parac')
            ->assertOk()
            ->assertJsonPath('medicines.0.med_name', 'Paracetamol')
            ->assertJsonPath('medicines.0.branches.0.id', $this->branchA->id);
    }

    public function test_catalog_finds_misspelled_name(): void
    {
        $this->actingAsWithSession($this->staff)
            ->getJson('/medicine-inventory/catalog?search=Parasetamol')
            ->assertOk()
            ->assertJsonPath('medicines.0.med_name', 'Paracetamol');
    }

    public function test_similar_spelling_requires_confirmation(): void
    {
        // Seeded medicine is "Paracetamol"; "Parasetamol" sounds the same.
        $this->actingAsWithSession($this->admin)
            ->post('/medicine-inventory', $this->medicinePayload([
                'branch_ids' => [$this->branchB->id],
                'med_name' => 'Parasetamol',
            ]))
            ->assertSessionHasErrors('confirm_new_name');

        $this->assertDatabaseMissing('tbl_products', ['med_name' => 'Parasetamol']);
    }

    public function test_confirmed_similar_spelling_is_saved(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post('/medicine-inventory', $this->medicinePayload([
                'branch_ids' => [$this->branchB->id],
                'med_name' => 'Parasetamol',
                'confirm_new_name' => true,
            ]))
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('tbl_products', [
            'med_name' => 'Parasetamol',
            'branch_id' => $this->branchB->id,
        ]);
    }

    public function test_existing_spelling_with_different_dose_needs_no_confirmation(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post('/medicine-inventory', $this->medicinePayload([
                'branch_ids' => [$this->branchB->id],
                'med_name' => 'paracetamol',
                'dose' => '250mg',
            ]))
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('tbl_products', [
            'med_name' => 'paracetamol',
            'dose' => '250mg',
            'branch_id' => $this->branchB->id,
        ]);
    }

    public function test_unrelated_name_needs_no_confirmation(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post('/medicine-inventory', $this->medicinePayload())
            ->assertSessionHasNoErrors();
    }

    public function test_similar_endpoint_lists_sound_alike_medicines(): void
    {
        $this->actingAsWithSession($this->staff)
            ->getJson('/medicine-inventory/similar?med_name=Parasetamol')
            ->assertOk()
            ->assertJsonCount(1, 'medicines')
            ->assertJsonPath('medicines.0.med_name', 'Paracetamol')
            ->assertJsonPath('medicines.0.branches.0.branch_name', 'Main Branch');

        $this->actingAsWithSession($this->staff)
            ->getJson('/medicine-inventory/similar?med_name=Paracetamol')
            ->assertOk()
            ->assertJsonCount(0, 'medicines');
    }

    private function medicineInBranchB(): MedicineProduct
    {
        return MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Amlodipine',
            'dose' => '5mg',
            'form' => 'Tablet',
            'pack_size' => 10,
            'retail_price' => 2,
            'wholesale_price' => 18,
            'status' => 'Active',
        ]);
    }

    public function test_admin_can_add_stock_to_another_branch_medicine(): void
    {
        $medicine = $this->medicineInBranchB();

        foreach ([$this->admin, $this->superadmin] as $user) {
            $this->actingAsWithSession($user)
                ->post('/medicine-inventory/stock', [
                    'product_id' => $medicine->id,
                    'boxes_received' => 2,
                    'unit_type' => 'Box',
                    'lot_number' => "LOT-{$user->id}",
                ])
                ->assertSessionHasNoErrors()
                ->assertRedirect();
        }

        $this->assertSame(40, (int) $medicine->batches()->sum('quantity'));
        $this->assertDatabaseHas('tbl_inventory_movement_logs', [
            'pd_id' => $medicine->id,
            'branch_id' => $this->branchB->id,
        ]);
    }

    public function test_staff_cannot_add_stock_to_another_branch_medicine(): void
    {
        $medicine = $this->medicineInBranchB();

        $this->actingAsWithSession($this->staff)
            ->post('/medicine-inventory/stock', [
                'product_id' => $medicine->id,
                'boxes_received' => 2,
            ])
            ->assertNotFound();

        $this->assertSame(0, $medicine->batches()->count());
    }

    public function test_staff_can_still_add_stock_to_own_branch(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post('/medicine-inventory/stock', [
                'product_id' => $this->product->id,
                'boxes_received' => 1,
                'unit_type' => 'Box',
                'lot_number' => 'LOT-NEW',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $this->assertDatabaseHas('products_qty', [
            'product_id' => $this->product->id,
            'lot_number' => 'LOT-NEW',
            'quantity' => 10,
        ]);
    }

    public function test_update_cannot_rename_into_existing_medicine(): void
    {
        $other = MedicineProduct::create([
            'branch_id' => $this->branchA->id,
            'med_name' => 'Ibuprofen',
            'dose' => '200mg',
            'form' => 'Tablet',
            'brand_name' => 'Advil',
            'pack_size' => 20,
            'retail_price' => 8,
            'wholesale_price' => 120,
            'status' => 'Active',
        ]);

        $this->actingAsWithSession($this->admin)
            ->patch("/medicine-inventory/{$other->id}", $this->medicinePayload([
                'med_name' => 'Paracetamol',
                'dose' => '500mg',
                'form' => 'Tablet',
                'brand_name' => 'Bioflu',
            ]))
            ->assertSessionHasErrors('med_name');
    }
}
