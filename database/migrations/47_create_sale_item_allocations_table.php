<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_sale_item_allocations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sale_item_id');
            $table->unsignedBigInteger('products_qty_id');
            $table->unsignedInteger('pieces');
            $table->timestamps();

            $table->foreign('sale_item_id')
                ->references('id')
                ->on('tbl_sales_items')
                ->cascadeOnDelete();

            $table->foreign('products_qty_id')
                ->references('id')
                ->on('products_qty')
                ->restrictOnDelete();

            $table->index(['sale_item_id', 'products_qty_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_sale_item_allocations');
    }
};
