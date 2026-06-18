<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products_qty', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('quantity')->default(0);
            $table->unsignedBigInteger('branch_id');
            $table->string('status', 50)->default('Active');
            $table->string('lot_number', 100)->nullable();
            $table->date('expiry')->nullable();
            $table->timestamps();

            $table->foreign('product_id')
                ->references('id')
                ->on('tbl_products')
                ->cascadeOnDelete();

            $table->foreign('branch_id')
                ->references('id')
                ->on('branches')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products_qty');
    }
};
