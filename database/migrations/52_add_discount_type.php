<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_sales', function (Blueprint $table) {
            $table->string('discount_type', 50)->nullable()->after('discount_amount');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_sales', function (Blueprint $table) {
            $table->dropColumn('discount_type');
        });
    }
};