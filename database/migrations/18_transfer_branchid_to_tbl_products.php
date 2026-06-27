<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add branch_id to tbl_products first (before removing it from products_qty)
        if (Schema::hasTable('tbl_products') && ! Schema::hasColumn('tbl_products', 'branch_id')) {
            Schema::table('tbl_products', function (Blueprint $table) {
                $table->unsignedBigInteger('branch_id')->nullable()->after('id');

                $table->foreign('branch_id')
                    ->references('id')
                    ->on('branches')
                    ->cascadeOnDelete();
            });
        }

        // 2. Copy branch_id from products_qty onto each product (pick one branch if batches differ)
        if (
            Schema::hasTable('products_qty')
            && Schema::hasColumn('products_qty', 'branch_id')
            && Schema::hasColumn('tbl_products', 'branch_id')
        ) {
            DB::statement('
                UPDATE tbl_products p
                INNER JOIN (
                    SELECT product_id, MIN(branch_id) AS branch_id
                    FROM products_qty
                    GROUP BY product_id
                ) pq ON p.id = pq.product_id
                SET p.branch_id = pq.branch_id
            ');
        }

        // 3. Remove branch_id from products_qty
        if (Schema::hasTable('products_qty') && Schema::hasColumn('products_qty', 'branch_id')) {
            Schema::table('products_qty', function (Blueprint $table) {
                $table->dropForeign(['branch_id']);
                $table->dropColumn('branch_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('products_qty') && ! Schema::hasColumn('products_qty', 'branch_id')) {
            Schema::table('products_qty', function (Blueprint $table) {
                $table->unsignedBigInteger('branch_id')->nullable()->after('product_id');

                $table->foreign('branch_id')
                    ->references('id')
                    ->on('branches')
                    ->cascadeOnDelete();
            });

            if (Schema::hasColumn('tbl_products', 'branch_id')) {
                DB::statement('
                    UPDATE products_qty pq
                    INNER JOIN tbl_products p ON pq.product_id = p.id
                    SET pq.branch_id = p.branch_id
                    WHERE p.branch_id IS NOT NULL
                ');
            }
        }

        if (Schema::hasTable('tbl_products') && Schema::hasColumn('tbl_products', 'branch_id')) {
            Schema::table('tbl_products', function (Blueprint $table) {
                $table->dropForeign(['branch_id']);
                $table->dropColumn('branch_id');
            });
        }
    }
};
