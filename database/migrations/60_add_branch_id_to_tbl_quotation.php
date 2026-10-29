<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * QUO-1: quotations belong to a branch so staff only see their own.
 *
 * Existing rows are backfilled from their customer's branch. tbl_quotation
 * has no creator column, so a row whose customer has no branch stays null
 * and is visible to admins/superadmins only.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_quotation', function (Blueprint $table) {
            $table->unsignedBigInteger('branch_id')->nullable()->after('customer_id');
            $table->foreign('branch_id')->references('id')->on('branches')->nullOnDelete();
            $table->index('branch_id');
        });

        DB::statement('
            UPDATE tbl_quotation q
            JOIN tbl_customers c ON c.customer_id = q.customer_id
            SET q.branch_id = c.branch_id
            WHERE q.branch_id IS NULL
        ');
    }

    public function down(): void
    {
        Schema::table('tbl_quotation', function (Blueprint $table) {
            $table->dropForeign(['branch_id']);
            $table->dropIndex(['branch_id']);
            $table->dropColumn('branch_id');
        });
    }
};
