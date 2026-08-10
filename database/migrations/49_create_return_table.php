<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_returns', function (Blueprint $table) {
            $table->id('return_id');
            $table->unsignedBigInteger('customer_id');
            $table->unsignedBigInteger('branch_id');
            $table->date('return_date');
            $table->string('received_by');
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->foreign('customer_id')
                ->references('customer_id')
                ->on('tbl_customers')
                ->cascadeOnDelete();

            $table->foreign('branch_id')
                ->references('id')
                ->on('branches')
                ->cascadeOnDelete();

            $table->index('branch_id');
        });

        Schema::create('tbl_return_items', function (Blueprint $table) {
            $table->id('item_id');
            $table->unsignedBigInteger('return_id');
            $table->unsignedBigInteger('pd_id');
            $table->string('batch_number', 100);
            $table->date('expiry_date');
            $table->unsignedInteger('quantity_received');
            $table->unsignedInteger('pieces_received');
            $table->string('unit_type', 20)->default('piece');
            $table->decimal('unit_price', 9, 2)->default(0.00);
            $table->timestamps();

            $table->foreign('return_id')
                ->references('return_id')
                ->on('tbl_returns')
                ->cascadeOnDelete();

            $table->foreign('pd_id')
                ->references('id')
                ->on('tbl_products')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_return_items');
        Schema::dropIfExists('tbl_returns');
    }
};