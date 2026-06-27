<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Alter the existing product table to add branch scoping
        if (Schema::hasTable('tbl_product')) {
            Schema::table('tbl_product', function (Blueprint $table) {
                if (!Schema::hasColumn('tbl_product', 'branch_id')) {
                    $table->unsignedBigInteger('branch_id')->after('cat_id')->nullable();
                }
            });
        }

        // 2. Create the primary Stock-In history parent table
        Schema::create('tbl_stock_ins', function (Blueprint $table) {
            $table->id('stock_in_id');
            $table->string('supplier_name');
            $table->date('delivery_date');
            $table->unsignedBigInteger('branch_id');
            $table->string('received_by');
            $table->timestamps();
        });

        // 3. Create the Stock-In line items child table
        Schema::create('tbl_stock_in_items', function (Blueprint $table) {
            $table->id('item_id');
            $table->unsignedBigInteger('stock_in_id');
            $table->unsignedBigInteger('pd_id');
            $table->string('batch_number');
            $table->date('expiry_date');
            $table->integer('quantity_received');
            $table->enum('unit_type', ['Piece', 'Box']);
            $table->timestamps();

            // Constraints
            $table->foreign('stock_in_id')->references('stock_in_id')->on('tbl_stock_ins')->onDelete('cascade');
            $table->foreign('pd_id')->references('pd_id')->on('tbl_product')->onDelete('restrict');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_stock_in_items');
        Schema::dropIfExists('tbl_stock_ins');

        if (Schema::hasTable('tbl_product')) {
            Schema::table('tbl_product', function (Blueprint $table) {
                if (Schema::hasColumn('tbl_product', 'branch_id')) {
                    $table->dropColumn('branch_id');
                }
            });
        }
    }
};
