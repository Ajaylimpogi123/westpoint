<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_carts', function (Blueprint $table) {
            $table->string('customer_name')->nullable()->after('user_id');
            $table->unsignedBigInteger('customer_id')->nullable()->after('customer_name');

            $table->foreign('customer_id')
                ->references('customer_id')
                ->on('tbl_customers')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tbl_carts', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
            $table->dropColumn(['customer_name', 'customer_id']);
        });
    }
};
