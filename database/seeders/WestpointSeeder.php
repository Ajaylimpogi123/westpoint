<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class WestpointSeeder extends Seeder
{
    public function run(): void
    {
        if (Role::count() === 0) {
            Role::insert([
                ['id' => 1, 'role_name' => 'Staff', 'created_at' => now(), 'updated_at' => now()],
                ['id' => 2, 'role_name' => 'Admin', 'created_at' => now(), 'updated_at' => now()],
                ['id' => 3, 'role_name' => 'Superadmin', 'created_at' => now(), 'updated_at' => now()],
            ]);
        }

        $branch = Branch::firstOrCreate(['branch_name' => 'Main Branch']);

        User::updateOrCreate(
            ['email' => 'staff@westpoint.test'],
            [
                'name' => 'Staff User',
                'password' => Hash::make('password'),
                'role_id' => 1,
                'branch_id' => $branch->id,
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'admin@westpoint.test'],
            [
                'name' => 'Admin User',
                'password' => Hash::make('password'),
                'role_id' => 2,
                'branch_id' => $branch->id,
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'superadmin@westpoint.test'],
            [
                'name' => 'Superadmin User',
                'password' => Hash::make('password'),
                'role_id' => 3,
                'branch_id' => $branch->id,
                'email_verified_at' => now(),
            ]
        );

        $this->call(MedicineSampleSeeder::class);
    }
}
