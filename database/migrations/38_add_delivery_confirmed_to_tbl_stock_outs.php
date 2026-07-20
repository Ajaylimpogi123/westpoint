<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_stock_outs', function (Blueprint $table) {
            // Confirms the patient/recipient has physically received the
            // delivery — required before a "Dispensed to patient" stock-out
            // is also recorded as a completed sale.
            $table->boolean('delivery_confirmed')->default(false)->after('delivered_to_address');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_stock_outs', function (Blueprint $table) {
            $table->dropColumn('delivery_confirmed');
        });
    }
};
