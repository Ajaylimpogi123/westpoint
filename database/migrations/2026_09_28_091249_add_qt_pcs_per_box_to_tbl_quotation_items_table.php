<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // This timestamped filename sorts before 27_create_quotation_item_table,
        // so on a fresh database the table does not exist yet. In that case
        // 58_backfill_pieces_per_box_columns adds the column instead.
        if (! Schema::hasTable('tbl_quotation_items') || Schema::hasColumn('tbl_quotation_items', 'qt_pcs_per_box')) {
            return;
        }

        Schema::table('tbl_quotation_items', function (Blueprint $table) {
            $table->unsignedInteger('qt_pcs_per_box')->nullable()->after('qt_unit');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('tbl_quotation_items') || ! Schema::hasColumn('tbl_quotation_items', 'qt_pcs_per_box')) {
            return;
        }

        Schema::table('tbl_quotation_items', function (Blueprint $table) {
            $table->dropColumn('qt_pcs_per_box');
        });
    }
};
