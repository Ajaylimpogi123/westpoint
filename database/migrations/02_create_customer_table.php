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
            $table->string('cust_fname')->nullable();
            $table->string('cust_lname')->nullable();
            $table->integer('cust_contact')->nullable();
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
