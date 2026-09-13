<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_sales', function (Blueprint $table) {
            $table->string('status', 30)->default('Completed')->after('net_amount');
            $table->decimal('refunded_amount', 12, 2)->default(0)->after('status');
        });

        Schema::table('tbl_sales_items', function (Blueprint $table) {
            $table->unsignedInteger('returned_quantity')->default(0)->after('quantity_sold');
            $table->decimal('refunded_amount', 12, 2)->default(0)->after('discount_amount');
        });

        Schema::create('tbl_sale_returns', function (Blueprint $table) {
            $table->id('return_id');
            $table->unsignedBigInteger('sale_id');
            $table->unsignedBigInteger('branch_id');
            $table->unsignedBigInteger('processed_by');
            $table->string('received_by')->nullable();
            $table->text('reason')->nullable();
            $table->decimal('total_refund', 12, 2)->default(0);
            $table->timestamps();

            $table->foreign('sale_id')
                ->references('id')
                ->on('tbl_sales')
                ->cascadeOnDelete();

            $table->foreign('branch_id')
                ->references('id')
                ->on('branches')
                ->cascadeOnDelete();

            $table->foreign('processed_by')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();
        });

        Schema::create('tbl_sale_return_items', function (Blueprint $table) {
            $table->id('return_item_id');
            $table->unsignedBigInteger('return_id');
            $table->unsignedBigInteger('sale_item_id');
            $table->unsignedInteger('quantity_returned');
            $table->unsignedInteger('pieces_restocked');
            $table->decimal('refund_amount', 12, 2)->default(0);
            // [{products_qty_id, pieces}, ...] — which batch(es) received the
            // restocked pieces and how many each, for audit/traceability.
            $table->json('restocked_batches')->nullable();
            $table->timestamps();

            $table->foreign('return_id')
                ->references('return_id')
                ->on('tbl_sale_returns')
                ->cascadeOnDelete();

            $table->foreign('sale_item_id')
                ->references('id')
                ->on('tbl_sales_items')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_sale_return_items');
        Schema::dropIfExists('tbl_sale_returns');

        Schema::table('tbl_sales_items', function (Blueprint $table) {
            $table->dropColumn(['returned_quantity', 'refunded_amount']);
        });

        Schema::table('tbl_sales', function (Blueprint $table) {
            $table->dropColumn(['status', 'refunded_amount']);
        });
    }
};