<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            // How this line item was dispensed/costed — piece (retail price)
            // or box (wholesale price). Chosen when adding the item.
            $table->string('unit_type', 20)->default('piece')->after('expiry');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            $table->dropColumn('unit_type');
        });
    }
};
