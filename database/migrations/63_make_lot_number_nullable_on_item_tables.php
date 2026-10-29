<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * products_qty.lot_number is nullable (stock can be added without a lot
 * number), but the stock-out and transfer line snapshots required one, so
 * picking such a lot failed with "Column 'lot_number' cannot be null".
 * Transfer lines are also widened to the batch column's 100 characters.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            $table->string('lot_number', 100)->nullable()->change();
        });

        Schema::table('tbl_stock_transfer_items', function (Blueprint $table) {
            $table->string('lot_number', 100)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            $table->string('lot_number', 100)->nullable(false)->default('')->change();
        });

        Schema::table('tbl_stock_transfer_items', function (Blueprint $table) {
            $table->string('lot_number', 50)->nullable(false)->default('')->change();
        });
    }
};
