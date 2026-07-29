<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Records which form submissions have already been processed.
     *
     * Disabling the submit button does not stop an Enter keypress inside a
     * text input, nor a retried request. Stock Out and POS were accidentally
     * protected by their sufficiency checks, but only when stock happened to
     * be tight; Stock In had no check at all, so a duplicate simply doubled
     * the received quantity and merged into the same batch — indistinguishable
     * afterwards from one larger delivery.
     */
    public function up(): void
    {
        Schema::create('tbl_idempotency_keys', function (Blueprint $table) {
            $table->id();
            $table->string('scope', 60);
            $table->string('idempotency_key', 100);
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();

            $table->unique(['scope', 'idempotency_key']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_idempotency_keys');
    }
};
