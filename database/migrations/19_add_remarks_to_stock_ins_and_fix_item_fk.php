<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tbl_stock_ins') && ! Schema::hasColumn('tbl_stock_ins', 'remarks')) {
            Schema::table('tbl_stock_ins', function (Blueprint $table) {
                $table->text('remarks')->nullable()->after('received_by');
            });
        }

        if (! Schema::hasTable('tbl_stock_in_items')) {
            return;
        }

        Schema::table('tbl_stock_in_items', function (Blueprint $table) {
            if (Schema::hasColumn('tbl_stock_in_items', 'pd_id')) {
                try {
                    $table->dropForeign(['pd_id']);
                } catch (\Throwable) {
                    // Legacy FK may not exist in all environments.
                }
            }
        });

        if (Schema::hasTable('tbl_products')) {
            Schema::table('tbl_stock_in_items', function (Blueprint $table) {
                $table->foreign('pd_id')
                    ->references('id')
                    ->on('tbl_products')
                    ->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('tbl_stock_ins') && Schema::hasColumn('tbl_stock_ins', 'remarks')) {
            Schema::table('tbl_stock_ins', function (Blueprint $table) {
                $table->dropColumn('remarks');
            });
        }

        if (! Schema::hasTable('tbl_stock_in_items')) {
            return;
        }

        Schema::table('tbl_stock_in_items', function (Blueprint $table) {
            try {
                $table->dropForeign(['pd_id']);
            } catch (\Throwable) {
                //
            }
        });

        if (Schema::hasTable('tbl_product')) {
            Schema::table('tbl_stock_in_items', function (Blueprint $table) {
                $table->foreign('pd_id')
                    ->references('pd_id')
                    ->on('tbl_product')
                    ->restrictOnDelete();
            });
        }
    }
};
