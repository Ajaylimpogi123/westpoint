<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_sales', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number')->unique();
            $table->unsignedBigInteger('branch_id');
            $table->unsignedBigInteger('user_id');
            $table->decimal('gross_amount', 12, 2);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('net_amount', 12, 2);
            $table->string('payment_method');
            $table->timestamps();

            $table->foreign('branch_id')
                ->references('id')
                ->on('branches')
                ->cascadeOnDelete();

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();
        });

        Schema::create('tbl_sales_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sale_id');
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('products_qty_id')->nullable();
            $table->enum('unit_type', ['Piece', 'Box']);
            $table->unsignedInteger('quantity_sold');
            $table->decimal('price_used', 12, 2);
            $table->decimal('total_price', 12, 2);
            $table->timestamps();

            $table->foreign('sale_id')
                ->references('id')
                ->on('tbl_sales')
                ->cascadeOnDelete();

            $table->foreign('product_id')
                ->references('id')
                ->on('tbl_products')
                ->cascadeOnDelete();

            $table->foreign('products_qty_id')
                ->references('id')
                ->on('products_qty')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_sales_items');
        Schema::dropIfExists('tbl_sales');
    }
};
