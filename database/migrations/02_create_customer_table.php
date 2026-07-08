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
        Schema::create('tbl_customer', function (Blueprint $table) {
            $table->id('cust_id');
        
            $table->string('company_name')->nullable();
            $table->string('cust_name')->nullable();
            $table->string('address')->nullable();
            $table->integer('contact_no')->nullable();
            $table->integer('tin')->nullable();
            $table->string('cust_image')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tbl_customer');
    }
};
