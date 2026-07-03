<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_inventory_movement_logs', function (Blueprint $table) {
            $table->id('log_id');
            $table->unsignedBigInteger('branch_id');
            $table->string('movement_type', 50);
            $table->string('reference_label');
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->unsignedBigInteger('pd_id')->nullable();
            $table->string('medicine_name');
            $table->string('lot_number', 100)->nullable();
            $table->integer('quantity')->nullable();
            $table->unsignedBigInteger('performed_by');
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->foreign('branch_id')->references('id')->on('branches')->restrictOnDelete();
            $table->foreign('pd_id')->references('id')->on('tbl_products')->nullOnDelete();
            $table->foreign('performed_by')->references('id')->on('users')->restrictOnDelete();

            $table->index(['branch_id', 'created_at']);
            $table->index('movement_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_inventory_movement_logs');
    }
};
