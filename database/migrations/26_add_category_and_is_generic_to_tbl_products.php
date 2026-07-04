<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tbl_products', function (Blueprint $table) {
            if (! Schema::hasColumn('tbl_products', 'category')) {
                $table->string('category', 100)->nullable()->after('form');
            }

            if (! Schema::hasColumn('tbl_products', 'is_generic')) {
                $table->boolean('is_generic')->default(false)->after('category');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tbl_products', function (Blueprint $table) {
            $table->dropColumn(
                array_filter(
                    ['category', 'is_generic'],
                    fn ($col) => Schema::hasColumn('tbl_products', $col)
                )
            );
        });
    }
};
