<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tbl_order', function (Blueprint $table) {
            $table->id('od_id'); // ✅ already primary

            // ✅ Define columns ONCE
            $table->unsignedBigInteger('cust_id');
            $table->unsignedBigInteger('table_id');

            // ✅ Foreign keys
            $table->foreign('cust_id')
                  ->references('cust_id')
                  ->on('tbl_customer')
                  ->cascadeOnDelete();

            $table->foreign('table_id')
                  ->references('table_id')
                  ->on('bs_table')
                  ->cascadeOnDelete();

            $table->integer('table_number')->default(0);
            $table->string('invoice_no', 100)->default('');
            $table->string('payment_method', 100)->default('');
            $table->text('order_description')->nullable();

            $table->decimal('od_amount_due', 9, 2)->default(0.00);
            $table->decimal('od_discount', 9, 2)->default(0.00);
            $table->decimal('percent_discount', 9, 2)->default(0.00);
            $table->decimal('od_total_amt_due', 9, 2)->default(0.00);
            $table->decimal('od_payment', 9, 2)->default(0.00);
            $table->decimal('od_change', 9, 2)->default(0.00);
            $table->decimal('other_charges', 9, 2)->default(0.00);

            $table->integer('is_open')->default(0);
            $table->integer('is_print')->default(0);

            $table->text('od_remarks')->nullable();
            // $table->timestamp('od_date')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tbl_order');
    }
};