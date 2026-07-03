<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tbl_inventory_movement_logs') && ! Schema::hasColumn('tbl_inventory_movement_logs', 'metadata')) {
            Schema::table('tbl_inventory_movement_logs', function (Blueprint $table) {
                $table->json('metadata')->nullable()->after('remarks');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('tbl_inventory_movement_logs') && Schema::hasColumn('tbl_inventory_movement_logs', 'metadata')) {
            Schema::table('tbl_inventory_movement_logs', function (Blueprint $table) {
                $table->dropColumn('metadata');
            });
        }
    }
};
