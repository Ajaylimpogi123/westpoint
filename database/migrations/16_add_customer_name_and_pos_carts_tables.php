<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_sales', function (Blueprint $table) {
            $table->string('customer_name')->nullable()->after('user_id');
        });

        Schema::create('tbl_carts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('branch_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamps();

            $table->foreign('branch_id')
                ->references('id')
                ->on('branches')
                ->cascadeOnDelete();

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();

            $table->unique(['branch_id', 'user_id']);
        });

        Schema::create('tbl_cart_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cart_id');
            $table->unsignedBigInteger('product_id');
            $table->enum('unit_type', ['Piece', 'Box']);
            $table->unsignedInteger('quantity_sold');
            $table->timestamps();

            $table->foreign('cart_id')
                ->references('id')
                ->on('tbl_carts')
                ->cascadeOnDelete();

            $table->foreign('product_id')
                ->references('id')
                ->on('tbl_products')
                ->cascadeOnDelete();

            $table->unique(['cart_id', 'product_id', 'unit_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_cart_items');
        Schema::dropIfExists('tbl_carts');

        Schema::table('tbl_sales', function (Blueprint $table) {
            $table->dropColumn('customer_name');
        });
    }
};
