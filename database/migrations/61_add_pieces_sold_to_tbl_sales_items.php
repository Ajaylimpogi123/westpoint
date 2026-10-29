<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * POS-4: store the pieces a sale line actually deducted, so a void restocks
 * that amount instead of re-converting boxes with the current pack_size.
 *
 * Backfill for existing lines:
 *  - split-batch lines: SUM of their allocations (exact);
 *  - Piece lines: quantity_sold;
 *  - Box lines: quantity_sold x the medicine's current pack_size (best
 *    available; the pack size at sale time was never recorded).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_sales_items', function (Blueprint $table) {
            $table->unsignedInteger('pieces_sold')->nullable()->after('quantity_sold');
        });

        DB::statement('
            UPDATE tbl_sales_items si
            JOIN (
                SELECT sale_item_id, SUM(pieces) AS pieces
                FROM tbl_sale_item_allocations
                GROUP BY sale_item_id
            ) a ON a.sale_item_id = si.id
            SET si.pieces_sold = a.pieces
            WHERE si.pieces_sold IS NULL
        ');

        DB::statement("
            UPDATE tbl_sales_items si
            LEFT JOIN tbl_products p ON p.id = si.product_id
            SET si.pieces_sold = CASE
                WHEN LOWER(si.unit_type) = 'box' THEN si.quantity_sold * GREATEST(COALESCE(p.pack_size, 1), 1)
                ELSE si.quantity_sold
            END
            WHERE si.pieces_sold IS NULL
        ");
    }

    public function down(): void
    {
        Schema::table('tbl_sales_items', function (Blueprint $table) {
            $table->dropColumn('pieces_sold');
        });
    }
};
