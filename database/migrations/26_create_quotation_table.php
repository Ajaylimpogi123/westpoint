<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_quotation', function (Blueprint $table) {
            $table->id();

            // ── Customer ──────────────────────────────────────────
            $table->unsignedBigInteger('customer_id');
            $table->foreign('customer_id')
                  ->references('customer_id')
                  ->on('tbl_customers')
                  ->cascadeOnDelete();

            // ── Quotation identifiers ─────────────────────────────
            // Q.F.No shown at top-right of the form (e.g. 427481)
            $table->string('qt_no', 100)->unique();

            // S.I.D. number shown at top-left (e.g. 673492)
            $table->string('sid_no', 100)->nullable();

            // ── Header info ───────────────────────────────────────
            $table->date('qt_date');                            // 12-Mar-2026
            $table->string('address', 255)->nullable();        // customer address
            $table->enum('delivery_type', ['pick-up', 'delivery'])->default('pick-up');
            $table->text('qt_remarks')->nullable();            // LTO / remarks line
            $table->string('checked_by', 100)->nullable();     // Checked by: field

            // ── Totals ────────────────────────────────────────────
            // item subtotals are computed from tbl_quotation_items
            $table->decimal('total_amount', 12, 2)->default(0.00);

            // ── Audit / print trail ───────────────────────────────
            $table->string('printed_by', 100)->nullable();     // "Printed by ELLA"
            $table->string('time_printed', 100)->nullable();   // "03-12-2026 03:18 PM"
            $table->string('prepared_by', 100)->nullable();    // signature field
            $table->date('date_signed')->nullable();
            $table->string('received_by', 100)->nullable();
            $table->string('approved_by', 100)->nullable();

            // ── Status ────────────────────────────────────────────
            $table->enum('status', ['draft', 'sent', 'approved', 'cancelled'])
                  ->default('draft');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_quotation');
    }
};