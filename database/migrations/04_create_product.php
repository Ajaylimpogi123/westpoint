<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
      Schema::create('tbl_product', function (Blueprint $table) {
            $table->id('pd_id');
            $table->unsignedBigInteger('cat_id'); // ✅ MATCH

       
            $table->string('pd_name', 244)->default('');
            $table->text('pd_description')->nullable();
            $table->decimal('pd_price', 9, 2)->default(0.00);
            $table->bigInteger('pd_qty')->default(0); // ✅ FIXED (no auto increment)
            $table->decimal('pd_cost', 9, 2)->default(0.00);
            $table->decimal('mark_up', 9, 2)->default(0.00);
            $table->Integer('pd_mqty')->default(0);
            $table->string('pd_image', 240)->nullable();
            $table->string('pd_status', 100)->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            $table->foreign('cat_id')
            ->references('cat_id')
            ->on('tbl_category')
            ->cascadeOnDelete();


    });
    }
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tbl_product');
     
    }
};
