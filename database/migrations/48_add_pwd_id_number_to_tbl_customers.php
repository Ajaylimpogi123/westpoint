<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_customers', function (Blueprint $table) {
            $table->string('pwd_id_number', 50)->nullable()->after('senior_id_number');
            $table->index('pwd_id_number');
        });
    }

    public function down(): void
    {
        Schema::table('tbl_customers', function (Blueprint $table) {
            $table->dropIndex(['pwd_id_number']);
            $table->dropColumn('pwd_id_number');
        });
    }
};
