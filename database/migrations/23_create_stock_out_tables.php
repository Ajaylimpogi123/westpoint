<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_stock_outs', function (Blueprint $table) {
            $table->id('stock_out_id');
            $table->string('transaction_subtype');
            $table->unsignedBigInteger('branch_id');
            $table->string('patient_reference')->nullable();
            $table->string('issued_by');
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->foreign('branch_id')->references('id')->on('branches')->restrictOnDelete();
        });

        Schema::create('tbl_stock_out_items', function (Blueprint $table) {
            $table->id('item_id');
            $table->unsignedBigInteger('stock_out_id');
            $table->unsignedBigInteger('pd_id');
            $table->string('lot_number', 100);
            $table->unsignedInteger('quantity_deducted');
            $table->timestamps();

            $table->foreign('stock_out_id')
                ->references('stock_out_id')
                ->on('tbl_stock_outs')
                ->onDelete('cascade');
            $table->foreign('pd_id')
                ->references('id')
                ->on('tbl_products')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_stock_out_items');
        Schema::dropIfExists('tbl_stock_outs');
    }
};
