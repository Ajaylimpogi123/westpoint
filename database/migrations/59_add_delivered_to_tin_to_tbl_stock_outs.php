<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_stock_outs', function (Blueprint $table) {
            // Recipient's TIN, printed on the delivery receipt.
            $table->string('delivered_to_tin', 50)->nullable()->after('delivered_to');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_stock_outs', function (Blueprint $table) {
            $table->dropColumn('delivered_to_tin');
        });
    }
};
