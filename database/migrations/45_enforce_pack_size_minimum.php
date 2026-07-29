<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Make "pack_size is at least 1" an invariant instead of something each
     * call site defended against individually.
     *
     * The frontend defaulted a missing pack_size to 1 while the backend used
     * the raw value, so a zero pack_size made the two sides disagree: the
     * operator saw N pieces and the database recorded none. Rather than
     * duplicating the fallback server-side, the value is repaired here and
     * held above zero by validation on every write path.
     */
    public function up(): void
    {
        $offending = DB::table('tbl_products')
            ->where(function ($query) {
                $query->whereNull('pack_size')->orWhere('pack_size', '<', 1);
            })
            ->pluck('med_name', 'id');

        if ($offending->isNotEmpty()) {
            // Recorded rather than silently corrected — a pack size of 1 is a
            // safe default but may not be the true one, and any box-denominated
            // history for these products is suspect.
            Log::warning('Repaired invalid pack_size values during migration.', [
                'products' => $offending->toArray(),
            ]);
        }

        DB::table('tbl_products')
            ->where(function ($query) {
                $query->whereNull('pack_size')->orWhere('pack_size', '<', 1);
            })
            ->update(['pack_size' => 1]);

        // MySQL ignores CHECK constraints before 8.0.16, so this is advisory
        // on older servers and enforced on newer ones. Validation is the
        // primary guard either way.
        try {
            DB::statement('ALTER TABLE tbl_products ADD CONSTRAINT chk_pack_size_min CHECK (pack_size >= 1)');
        } catch (\Throwable $exception) {
            Log::info('Could not add pack_size check constraint; relying on application validation.', [
                'reason' => $exception->getMessage(),
            ]);
        }
    }

    public function down(): void
    {
        try {
            DB::statement('ALTER TABLE tbl_products DROP CONSTRAINT chk_pack_size_min');
        } catch (\Throwable) {
            // Constraint was never created on this server.
        }
    }
};
