<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * performed_by was NOT NULL, which meant only a request with an
     * authenticated user could write to the ledger. Scheduled work — expiring
     * lapsed batches, for one — has no user, and silently skipping the ledger
     * entry is what makes a ledger stop reconciling.
     */
    public function up(): void
    {
        Schema::table('tbl_inventory_movement_logs', function (Blueprint $table) {
            $table->unsignedBigInteger('performed_by')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('tbl_inventory_movement_logs', function (Blueprint $table) {
            $table->unsignedBigInteger('performed_by')->nullable(false)->change();
        });
    }
};
