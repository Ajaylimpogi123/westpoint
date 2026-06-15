<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
      Schema::create('tbl_order_items', function (Blueprint $table) {
        $table->id('oid_id');
    
        $table->unsignedBigInteger('od_id');
        $table->unsignedBigInteger('pd_id');
    
        $table->bigInteger('oi_qty')->default(0);
        $table->decimal('oi_price', 10, 2)->default(0);
    
        $table->timestamps();
    
        $table->foreign('od_id')
              ->references('od_id')
              ->on('tbl_order')
              ->cascadeOnDelete();
    
        $table->foreign('pd_id')
              ->references('pd_id')
              ->on('tbl_product')
              ->restrictOnDelete(); // cleaner
    });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tbl_order_items');
    }
};