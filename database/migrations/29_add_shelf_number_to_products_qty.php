<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products_qty', function (Blueprint $table) {
            if (! Schema::hasColumn('products_qty', 'shelf_number')) {
                $table->string('shelf_number', 50)->nullable()->after('expiry');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products_qty', function (Blueprint $table) {
            if (Schema::hasColumn('products_qty', 'shelf_number')) {
                $table->dropColumn('shelf_number');
            }
        });
    }
};
