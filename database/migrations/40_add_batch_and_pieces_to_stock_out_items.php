<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Stock-out lines previously identified their batch by lot_number alone,
     * which is not unique — the same lot received with a different expiry or
     * shelf is a separate row. Record the batch id so the line points at the
     * exact physical batch, and record the piece count so the ledger can be
     * reconciled independently of the transacted unit.
     */
    public function up(): void
    {
        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            if (! Schema::hasColumn('tbl_stock_out_items', 'products_qty_id')) {
                $table->unsignedBigInteger('products_qty_id')->nullable()->after('pd_id');
            }

            if (! Schema::hasColumn('tbl_stock_out_items', 'pieces_deducted')) {
                $table->unsignedInteger('pieces_deducted')->nullable()->after('quantity_deducted');
            }

            // Price at dispense time. Reading the product's current price at
            // delivery-confirmation time let an edit in between silently
            // restate the value of an already-dispensed line.
            if (! Schema::hasColumn('tbl_stock_out_items', 'unit_price')) {
                $table->decimal('unit_price', 12, 2)->nullable()->after('unit_type');
            }
        });

        // Backfill the batch reference where the lot number is unambiguous.
        // Rows with duplicate lot numbers are deliberately left null rather
        // than guessed at — that ambiguity is exactly the defect being fixed.
        DB::statement('
            UPDATE tbl_stock_out_items soi
            INNER JOIN (
                SELECT product_id, lot_number, MIN(id) AS batch_id, COUNT(*) AS matches
                FROM products_qty
                GROUP BY product_id, lot_number
                HAVING COUNT(*) = 1
            ) pq ON pq.product_id = soi.pd_id AND pq.lot_number = soi.lot_number
            SET soi.products_qty_id = pq.batch_id
            WHERE soi.products_qty_id IS NULL
        ');

        // Historically the deduction ignored unit_type entirely, so the pieces
        // actually removed equal quantity_deducted regardless of unit. Backfill
        // the truth rather than the intent; box rows where these two disagree
        // with pack_size are the drift that needs a physical reconciliation.
        DB::statement('
            UPDATE tbl_stock_out_items
            SET pieces_deducted = quantity_deducted
            WHERE pieces_deducted IS NULL
        ');

        // Canonicalise casing. Every other table stores Piece/Box; only this
        // one stored piece/box, forcing translation at each comparison.
        DB::table('tbl_stock_out_items')->where('unit_type', 'piece')->update(['unit_type' => 'Piece']);
        DB::table('tbl_stock_out_items')->where('unit_type', 'box')->update(['unit_type' => 'Box']);

        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            $table->string('unit_type', 20)->default('Piece')->change();

            $table->foreign('products_qty_id')
                ->references('id')
                ->on('products_qty')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tbl_stock_out_items', function (Blueprint $table) {
            $table->dropForeign(['products_qty_id']);
            $table->dropColumn(['products_qty_id', 'pieces_deducted', 'unit_price']);
            $table->string('unit_type', 20)->default('piece')->change();
        });

        DB::table('tbl_stock_out_items')->where('unit_type', 'Piece')->update(['unit_type' => 'piece']);
        DB::table('tbl_stock_out_items')->where('unit_type', 'Box')->update(['unit_type' => 'box']);
    }
};
