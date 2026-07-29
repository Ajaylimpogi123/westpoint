<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Record the converted piece count alongside the transacted quantity so a
     * stock-in line can be reconciled against products_qty without having to
     * re-derive it from the product's current pack_size — which may since
     * have been edited.
     */
    public function up(): void
    {
        Schema::table('tbl_stock_in_items', function (Blueprint $table) {
            if (! Schema::hasColumn('tbl_stock_in_items', 'pieces_received')) {
                $table->unsignedInteger('pieces_received')->nullable()->after('quantity_received');
            }
        });

        // Stock-in has always converted correctly, so the historical piece
        // count can be reconstructed from the product's pack_size.
        DB::statement("
            UPDATE tbl_stock_in_items sii
            INNER JOIN tbl_products p ON p.id = sii.pd_id
            SET sii.pieces_received = CASE
                WHEN LOWER(sii.unit_type) = 'box' THEN sii.quantity_received * GREATEST(p.pack_size, 1)
                ELSE sii.quantity_received
            END
            WHERE sii.pieces_received IS NULL
        ");
    }

    public function down(): void
    {
        Schema::table('tbl_stock_in_items', function (Blueprint $table) {
            $table->dropColumn('pieces_received');
        });
    }
};
