<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Each row = one line item on the quotation form
        // One quotation → many items (the "Item(s): 1" counter on the form)
        Schema::create('tbl_quotation_items', function (Blueprint $table) {
            $table->id();

            // ── Parent ────────────────────────────────────────────
            $table->unsignedBigInteger('quotation_id');
            $table->foreign('quotation_id')
                  ->references('id')
                  ->on('tbl_quotation')
                  ->cascadeOnDelete();   // delete items when quotation is deleted

            // ── Line item — mirrors the table columns on the form ─
            $table->integer('qt_qty');                          // 200
            $table->string('qt_unit', 50)->nullable();          // BXS, PCS, TAB…
            $table->text('qt_description');                     // Tablet - Sitagliptin 50mg…
            $table->string('lot_number', 100)->nullable();      // Lot No.: EFF5001
            $table->date('expiry_date')->nullable();            // Expiry Date: 10-2028
            $table->decimal('qt_unit_price', 12, 2)->default(0.00);  // 128.00
            $table->decimal('amount', 12, 2)->default(0.00);         // 25,600.00 (qty × unit_price)

            // ── Sort order ────────────────────────────────────────
            // Preserves the print order of items on the form
            $table->unsignedInteger('sort_order')->default(0);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_quotation_items');
    }
};