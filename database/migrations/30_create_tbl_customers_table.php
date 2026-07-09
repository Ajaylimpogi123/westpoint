<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_customers', function (Blueprint $table) {
            $table->id('customer_id');
            $table->unsignedBigInteger('branch_id');
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('phone_number', 11)->nullable();
            $table->string('email', 100)->nullable();
            $table->text('address')->nullable();
            $table->string('customer_type')->default('Regular');
            $table->string('status')->default('active');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('branch_id')->references('id')->on('branches')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();

            $table->index('branch_id');
            $table->index('phone_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_customers');
    }
};
