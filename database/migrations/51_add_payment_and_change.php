<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_sales', function (Blueprint $table) {
            $table->decimal('amount_received', 12, 2)->nullable()->after('net_amount');
            $table->decimal('change_due', 12, 2)->nullable()->after('amount_received');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_sales', function (Blueprint $table) {
            $table->dropColumn(['amount_received', 'change_due']);
        });
    }
};