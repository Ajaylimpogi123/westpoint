<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_products', function (Blueprint $table) {
            $table->enum('vat_status', ['VAT', 'Non-VAT'])
                ->default('Non-VAT')
                ->after('wholesale_price');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_products', function (Blueprint $table) {
            $table->dropColumn('vat_status');
        });
    }
};