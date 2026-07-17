<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_stock_outs', function (Blueprint $table) {
            $table->string('delivered_to')->nullable()->after('remarks');
            $table->string('delivered_to_address')->nullable()->after('delivered_to');
        });

        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            // Snapshot — copied at transaction time so expiry is preserved
            // even if the source lot is later depleted or edited.
            $table->date('expiry')->nullable()->after('quantity_deducted');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            $table->dropColumn('expiry');
        });

        Schema::table('tbl_stock_outs', function (Blueprint $table) {
            $table->dropColumn(['delivered_to', 'delivered_to_address']);
        });
    }
};
