<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE tbl_customers CHANGE phone_number senior_id_number VARCHAR(50) NULL');

        if (Schema::hasColumn('tbl_customers', 'senior_id_number')) {
            DB::statement('ALTER TABLE tbl_customers DROP INDEX tbl_customers_phone_number_index');
            DB::statement('ALTER TABLE tbl_customers ADD INDEX tbl_customers_senior_id_number_index (senior_id_number)');
        }
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE tbl_customers DROP INDEX tbl_customers_senior_id_number_index');
        DB::statement('ALTER TABLE tbl_customers CHANGE senior_id_number phone_number VARCHAR(11) NULL');
        DB::statement('ALTER TABLE tbl_customers ADD INDEX tbl_customers_phone_number_index (phone_number)');
    }
};
