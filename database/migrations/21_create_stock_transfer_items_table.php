<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_stock_transfer_items', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('stock_transfer_id');

            // Product reference (from branch)
            $table->unsignedBigInteger('product_id');       // tbl_products.id

            // Specific lot being transferred
            $table->unsignedBigInteger('products_qty_id');  // products_qty.id (source lot)

            // Snapshot — copied at request time so lot info is preserved
            // even if products_qty is later edited or quantity changes
            $table->string('lot_number', 50);
            $table->date('expiry')->nullable();

            // Quantities
            $table->unsignedInteger('quantity_requested');  // what secretary asked for
            $table->unsignedInteger('quantity_approved')->nullable(); // what admin allows (can be less)

            $table->timestamps();

            // Foreign keys
            $table->foreign('stock_transfer_id')
                  ->references('id')->on('tbl_stock_transfers')
                  ->onDelete('cascade');

            $table->foreign('product_id')
                  ->references('id')->on('tbl_products');

            $table->foreign('products_qty_id')
                  ->references('id')->on('products_qty');

            // Indexes
            $table->index('stock_transfer_id');
            $table->index('product_id');
            $table->index('products_qty_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_stock_transfer_items');
    }
};