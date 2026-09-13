<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_sales_items', function (Blueprint $table) {
            $table->boolean('vat_exempt')->default(false)->after('discount_amount');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_sales_items', function (Blueprint $table) {
            $table->dropColumn('vat_exempt');
        });
    }
};