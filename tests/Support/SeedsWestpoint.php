<?php

namespace Tests\Support;

use App\Models\Branch;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

trait SeedsWestpoint
{
    protected Branch $branchA;

    protected Branch $branchB;

    protected User $staff;

    protected User $admin;

    protected User $superadmin;

    protected MedicineProduct $product;

    protected ProductQty $batch;

    protected function seedWestpoint(): void
    {
        Role::insert([
            ['id' => 1, 'role_name' => 'Staff', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'role_name' => 'Admin', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'role_name' => 'Superadmin', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->branchA = Branch::create(['branch_name' => 'Main Branch']);
        $this->branchB = Branch::create(['branch_name' => 'Second Branch']);

        $this->staff = User::create([
            'name' => 'Staff User',
            'email' => 'staff@westpoint.test',
            'password' => Hash::make('password'),
            'role_id' => 1,
            'branch_id' => $this->branchA->id,
            'email_verified_at' => now(),
        ]);

        $this->admin = User::create([
            'name' => 'Admin User',
            'email' => 'admin@westpoint.test',
            'password' => Hash::make('password'),
            'role_id' => 2,
            'branch_id' => $this->branchA->id,
            'email_verified_at' => now(),
        ]);

        $this->superadmin = User::create([
            'name' => 'Superadmin User',
            'email' => 'superadmin@westpoint.test',
            'password' => Hash::make('password'),
            'role_id' => 3,
            'branch_id' => $this->branchA->id,
            'email_verified_at' => now(),
        ]);

        $this->product = MedicineProduct::create([
            'branch_id' => $this->branchA->id,
            'med_name' => 'Paracetamol',
            'dose' => '500mg',
            'form' => 'Tablet',
            'pack_size' => 10,
            'brand_name' => 'Bioflu',
            'retail_price' => 5.00,
            'wholesale_price' => 45.00,
            'status' => 'Active',
            'is_generic' => false,
        ]);

        $this->batch = ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 100,
            'status' => 'Active',
            'lot_number' => 'LOT-001',
            'expiry' => now()->addYear()->toDateString(),
        ]);
    }

    protected function actingAsWithSession(User $user)
    {
        return $this->actingAs($user)->withSession([
            'role_id' => $user->role_id,
            'branch_id' => $user->branch_id,
        ]);
    }
}
