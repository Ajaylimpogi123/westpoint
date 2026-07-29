<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Backing store for gapless, ordered document numbers.
     *
     * Invoice numbers were previously random within a 99,999 space and only
     * guarded by a unique index, so same-day collisions aborted sales at a
     * rate that grows with volume (~18% chance per day at 200 sales). A
     * counter allocated inside the sale's own transaction removes the
     * collision entirely and produces the ordered series an audit expects.
     */
    public function up(): void
    {
        Schema::create('tbl_document_sequences', function (Blueprint $table) {
            $table->id();
            // e.g. "pos_invoice:3" — document type scoped to a branch
            $table->string('scope', 100);
            // e.g. "20260729" — the window the counter resets on
            $table->string('period', 20);
            $table->unsignedBigInteger('last_number')->default(0);
            $table->timestamps();

            $table->unique(['scope', 'period']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_document_sequences');
    }
};
