<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_quotation', function (Blueprint $table) {
            $table->dropForeign(['cust_id']);
            $table->dropColumn('cust_id');
        });

        Schema::table('tbl_quotation', function (Blueprint $table) {
            $table->unsignedBigInteger('customer_id')->after('id');
            $table->foreign('customer_id')
                  ->references('customer_id')
                  ->on('tbl_customers')
                  ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tbl_quotation', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
            $table->dropColumn('customer_id');
        });

        Schema::table('tbl_quotation', function (Blueprint $table) {
            $table->unsignedBigInteger('cust_id')->after('id');
            $table->foreign('cust_id')
                  ->references('cust_id')
                  ->on('tbl_customer')
                  ->cascadeOnDelete();
        });
    }
};
