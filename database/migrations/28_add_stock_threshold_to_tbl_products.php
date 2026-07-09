<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_products', function (Blueprint $table) {
            if (! Schema::hasColumn('tbl_products', 'stock_threshold')) {
                $table->unsignedInteger('stock_threshold')->nullable()->default(10)->after('retail_price');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tbl_products', function (Blueprint $table) {
            if (Schema::hasColumn('tbl_products', 'stock_threshold')) {
                $table->dropColumn('stock_threshold');
            }
        });
    }
};
