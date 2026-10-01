<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // This timestamped filename sorts before 23_create_stock_out_tables,
        // so on a fresh database the table does not exist yet. In that case
        // 58_backfill_pieces_per_box_columns adds the column instead.
        if (! Schema::hasTable('tbl_stock_out_items') || Schema::hasColumn('tbl_stock_out_items', 'pieces_per_box')) {
            return;
        }

        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            $table->unsignedInteger('pieces_per_box')->nullable()->after('unit_type');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('tbl_stock_out_items') || ! Schema::hasColumn('tbl_stock_out_items', 'pieces_per_box')) {
            return;
        }

        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            $table->dropColumn('pieces_per_box');
        });
    }
};
