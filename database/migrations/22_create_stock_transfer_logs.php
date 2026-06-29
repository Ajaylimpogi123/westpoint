<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_stock_transfer_logs', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('stock_transfer_id');

            $table->enum('action', [
                'created',      // secretary submitted
                'approved',     // admin approved
                'rejected',     // admin rejected
                'cancelled',    // secretary cancelled
                'stock_moved',  // system deducted/added quantities
            ]);

            $table->unsignedBigInteger('performed_by'); // users.id
            $table->text('note')->nullable();           // optional extra info

            $table->timestamp('created_at')->useCurrent();

            // Foreign keys
            $table->foreign('stock_transfer_id')
                  ->references('id')->on('tbl_stock_transfers')
                  ->onDelete('cascade');

            $table->foreign('performed_by')
                  ->references('id')->on('users');

            // Index
            $table->index('stock_transfer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_stock_transfer_logs');
    }
};