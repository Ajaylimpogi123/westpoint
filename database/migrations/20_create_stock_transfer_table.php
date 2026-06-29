<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_stock_transfers', function (Blueprint $table) {
            $table->id();

            // Reference number shown in UI (e.g. TR-2026-00001)
            $table->string('transfer_no', 20)->unique();

            // Route
            $table->unsignedBigInteger('from_branch_id');
            $table->unsignedBigInteger('to_branch_id');

            // People
            $table->unsignedBigInteger('requested_by');   // users.id (secretary/staff)
            $table->unsignedBigInteger('approved_by')->nullable(); // users.id (admin)

            // Status
            $table->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])
                  ->default('pending');

            // Meta
            $table->enum('priority', ['normal', 'urgent', 'routine'])->default('normal');
            $table->text('reason')->nullable();          // secretary's reason
            $table->text('rejection_note')->nullable();  // admin's reason when rejected
            $table->date('needed_by')->nullable();        // optional target date
            $table->date('transfer_date');

            // Timestamps
            $table->datetime('approved_at')->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('from_branch_id')->references('id')->on('branches');
            $table->foreign('to_branch_id')->references('id')->on('branches');
            $table->foreign('requested_by')->references('id')->on('users');
            $table->foreign('approved_by')->references('id')->on('users');

            // Indexes
            $table->index('status');
            $table->index('from_branch_id');
            $table->index('to_branch_id');
            $table->index('requested_by');
            $table->index('transfer_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_stock_transfers');
    }
};