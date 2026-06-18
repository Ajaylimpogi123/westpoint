<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_products', function (Blueprint $table) {
            $table->id();
            $table->string('med_name', 244);
            $table->string('dose', 100)->nullable();
            $table->string('form', 100)->nullable();
            $table->unsignedInteger('pack_size')->default(1);
            $table->string('brand_name', 244)->nullable();
            $table->decimal('retail_price', 9, 2)->default(0.00);
            $table->decimal('wholesale_price', 9, 2)->default(0.00);
            $table->string('status', 50)->default('Active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_products');
    }
};
