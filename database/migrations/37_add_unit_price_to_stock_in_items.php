<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tbl_stock_in_items')) {
            return;
        }

        Schema::table('tbl_stock_in_items', function (Blueprint $table) {
            if (! Schema::hasColumn('tbl_stock_in_items', 'unit_price')) {
                $table->decimal('unit_price', 12, 2)->nullable()->after('unit_type');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('tbl_stock_in_items')) {
            return;
        }

        Schema::table('tbl_stock_in_items', function (Blueprint $table) {
            if (Schema::hasColumn('tbl_stock_in_items', 'unit_price')) {
                $table->dropColumn('unit_price');
            }
        });
    }
};
