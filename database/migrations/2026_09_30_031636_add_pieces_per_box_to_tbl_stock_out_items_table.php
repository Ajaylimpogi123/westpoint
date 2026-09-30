<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            $table->unsignedInteger('pieces_per_box')->nullable()->after('unit_type');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            $table->dropColumn('pieces_per_box');
        });
    }
};