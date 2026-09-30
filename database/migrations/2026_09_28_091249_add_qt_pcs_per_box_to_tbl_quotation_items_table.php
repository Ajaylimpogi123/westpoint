<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_quotation_items', function (Blueprint $table) {
            $table->unsignedInteger('qt_pcs_per_box')->nullable()->after('qt_unit');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_quotation_items', function (Blueprint $table) {
            $table->dropColumn('qt_pcs_per_box');
        });
    }
};