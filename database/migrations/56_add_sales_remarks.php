<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_sales', function (Blueprint $table) {
            $table->text('sales_remarks')->nullable()->after('reference_number');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_sales', function (Blueprint $table) {
            $table->dropColumn('sales_remarks');
        });
    }
};