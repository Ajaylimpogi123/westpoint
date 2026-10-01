<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The two 2026_09_* migrations that add these columns sort lexically before
 * the numbered migrations that create their tables, so `migrate:fresh` (and
 * therefore every RefreshDatabase test) failed with "table doesn't exist".
 * They now skip when the table is missing; this adds the columns afterwards.
 * Databases that already ran them are left untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('tbl_quotation_items', 'qt_pcs_per_box')) {
            Schema::table('tbl_quotation_items', function (Blueprint $table) {
                $table->unsignedInteger('qt_pcs_per_box')->nullable()->after('qt_unit');
            });
        }

        if (! Schema::hasColumn('tbl_stock_out_items', 'pieces_per_box')) {
            Schema::table('tbl_stock_out_items', function (Blueprint $table) {
                $table->unsignedInteger('pieces_per_box')->nullable()->after('unit_type');
            });
        }
    }

    public function down(): void
    {
        // Intentionally empty: on databases where the original 2026_09_*
        // migrations created these columns, rolling this back must not drop them.
    }
};
