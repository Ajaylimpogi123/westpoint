<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The dashboard and sales reports filter tbl_sales by branch + date range and
 * by payment method; only the FK indexes existed, so every period filter was
 * a scan of the branch's (or the whole) sales history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_sales', function (Blueprint $table) {
            $table->index(['branch_id', 'created_at'], 'tbl_sales_branch_created_at_index');
            $table->index('created_at', 'tbl_sales_created_at_index');
            $table->index(['payment_method', 'created_at'], 'tbl_sales_payment_method_created_at_index');
        });
    }

    public function down(): void
    {
        // MySQL/MariaDB silently drop the FK's implicit branch_id index once the
        // (branch_id, created_at) composite can serve the foreign key, and then
        // refuse to drop the composite. Restore a branch_id index first.
        if (! in_array('tbl_sales_branch_id_foreign', Schema::getIndexListing('tbl_sales'), true)) {
            Schema::table('tbl_sales', function (Blueprint $table) {
                $table->index('branch_id', 'tbl_sales_branch_id_foreign');
            });
        }

        Schema::table('tbl_sales', function (Blueprint $table) {
            $table->dropIndex('tbl_sales_branch_created_at_index');
            $table->dropIndex('tbl_sales_created_at_index');
            $table->dropIndex('tbl_sales_payment_method_created_at_index');
        });
    }
};
