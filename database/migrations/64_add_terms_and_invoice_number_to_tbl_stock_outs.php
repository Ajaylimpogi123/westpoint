<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_stock_outs', function (Blueprint $table) {
            // Optional; printed in the Terms / Invoice # boxes of the delivery receipt.
            $table->string('terms', 100)->nullable()->after('delivered_to_address');
            $table->string('invoice_number', 100)->nullable()->after('terms');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_stock_outs', function (Blueprint $table) {
            $table->dropColumn(['terms', 'invoice_number']);
        });
    }
};
